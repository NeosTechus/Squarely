import type { SupabaseClient } from "@supabase/supabase-js";
import { wrapSoapEnvelope } from "@squarely/printing";

/**
 * Shape of a queued job row joined with its printer. We only read the fields
 * we need to dispatch — see the SELECT in `pollOnce`.
 */
interface JobRow {
  id: string;
  printer_id: string | null;
  payload: string;
  attempts: number;
  printers: {
    ip_address: string | null;
    port: number;
    kind: string;
    active: boolean;
  } | null;
}

export interface PollResult {
  processed: number;
  ok: number;
  failed: number;
}

/**
 * One poll tick. Reads queued jobs, claims each one atomically via a conditional
 * UPDATE (so two concurrent agents can't double-print), POSTs the stored ePOS
 * XML to the printer, then marks the job `printed` or `failed`.
 */
export async function pollOnce(
  sb: SupabaseClient,
  printerIds: string[] | null,
): Promise<PollResult> {
  let q = sb
    .from("print_jobs")
    .select(
      "id, printer_id, payload, attempts, printers!inner(ip_address, port, kind, active)",
    )
    .eq("status", "queued")
    .eq("printers.active", true)
    .eq("printers.kind", "lan")
    .order("created_at", { ascending: true })
    .limit(20);

  if (printerIds && printerIds.length > 0) {
    q = q.in("printer_id", printerIds);
  }

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as unknown as JobRow[];
  let ok = 0;
  let failed = 0;

  for (const row of rows) {
    // Claim by conditional UPDATE — skips rows another worker already grabbed.
    const { data: claimed, error: claimErr } = await sb
      .from("print_jobs")
      .update({
        status: "dispatched",
        dispatched_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();

    if (claimErr || !claimed) continue;

    const ip = row.printers?.ip_address;
    if (!ip) {
      await markFailed(sb, row, "printer has no ip_address");
      failed++;
      continue;
    }

    try {
      await postEposXml(ip, row.payload);
      await sb
        .from("print_jobs")
        .update({
          status: "printed",
          printed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      ok++;
    } catch (e) {
      await markFailed(sb, row, e instanceof Error ? e.message : String(e));
      failed++;
    }
  }

  return { processed: rows.length, ok, failed };
}

async function markFailed(
  sb: SupabaseClient,
  row: JobRow,
  msg: string,
): Promise<void> {
  await sb
    .from("print_jobs")
    .update({
      status: "failed",
      attempts: row.attempts + 1,
      last_error: msg.slice(0, 500),
    })
    .eq("id", row.id);
}

/**
 * POST the stored ePOS XML to the printer's service.cgi endpoint. If the
 * payload doesn't already carry the SOAP envelope we wrap it so we can accept
 * either shape from the producer.
 */
async function postEposXml(ip: string, payload: string): Promise<void> {
  const body = payload.includes("<s:Envelope")
    ? payload
    : wrapSoapEnvelope(payload);
  const url = `http://${ip}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: '""',
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const text = await res.text();
    if (!text.includes('success="true"')) {
      throw new Error(`Printer rejected: ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}
