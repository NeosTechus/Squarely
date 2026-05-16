import { buildReceiptXml, wrapSoapEnvelope } from "./xml";
import type { PrintResult, ReceiptJob } from "./types";

export interface LanPrintOptions {
  ipAddress: string;
  deviceId?: string;
  timeoutMs?: number;
}

/**
 * Direct LAN print to an Epson ePOS-capable printer (TM-m30III, TM-T88, etc.).
 * Mirrors the proven Fenton flow: POST SOAP-wrapped ePOS XML to
 * http://<ip>/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000
 *
 * Works from any platform that can `fetch` — Expo dev client, web admin,
 * Edge Functions running inside a merchant LAN tunnel, etc.
 */
export async function printOverLan(
  job: ReceiptJob,
  opts: LanPrintOptions,
): Promise<PrintResult> {
  const xml = wrapSoapEnvelope(buildReceiptXml(job));
  const deviceId = opts.deviceId ?? "local_printer";
  const timeout = opts.timeoutMs ?? 8000;
  const url = `http://${opts.ipAddress}/cgi-bin/epos/service.cgi?devid=${encodeURIComponent(
    deviceId,
  )}&timeout=${timeout}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout + 2000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: '""',
      },
      body: xml,
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, via: "lan", error: `HTTP ${res.status}` };
    }
    const text = await res.text();
    if (text.includes('success="true"')) {
      return { ok: true, via: "lan" };
    }
    return { ok: false, via: "lan", error: `Printer rejected: ${text.slice(0, 200)}` };
  } catch (err) {
    return {
      ok: false,
      via: "lan",
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
