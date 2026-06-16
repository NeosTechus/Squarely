import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rateLimit";
import { safeErrorMessage } from "@/lib/redact";

// Open the cash drawer WITHOUT printing a receipt. Used for making change
// between sales (a manager pop) and during shift close. Enqueues a
// drawer-only ePOS XML payload to print_jobs (job_type='drawer_pop',
// order_id=NULL) so the LAN agent's existing claim+retry pipeline carries
// it.
//
// Permission model: any active member can pop. Cashiers need this all
// shift; tightening it would mean handing the manager's badge over
// constantly.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Drawer-only ePOS XML — single pulse on drawer_1 (the only DK port wired
// on virtually every Epson receipt printer).
const DRAWER_ONLY_EPOS = [
  `<?xml version="1.0" encoding="utf-8"?>`,
  `<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">`,
  `<pulse drawer="drawer_1" time="pulse_100"/>`,
  `</epos-print>`,
].join("");

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  let body: { printerId?: string };
  try {
    body = (await req.json()) as { printerId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const printerIdHint = body.printerId?.trim() || null;

  const svc = getServiceSupabase();
  const { data: userData } = await svc.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Invalid token." }, { status: 401 });
  }

  // 30 pops/min/user. Not a security boundary — bounds physical drawer
  // hammering by a runaway client and prevents queue saturation.
  const rl = checkRateLimit(`printers/kick:${userId}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 1) } },
    );
  }

  // Resolve caller's active merchant via membership.
  const { data: member } = await (svc as any)
    .from("merchant_members")
    .select("merchant_id")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  const merchantId = (member as { merchant_id?: string } | null)?.merchant_id;
  if (!merchantId) {
    return NextResponse.json({ ok: false, error: "No active merchant." }, { status: 403 });
  }

  // Pick a printer: explicit (scoped to merchant) OR default-with-drawer
  // OR first active drawer-capable printer.
  type PrinterPick = { id: string };
  let printer: PrinterPick | null = null;
  if (printerIdHint) {
    const { data } = await (svc as any)
      .from("printers")
      .select("id")
      .eq("id", printerIdHint)
      .eq("merchant_id", merchantId)
      .eq("active", true)
      .eq("supports_cash_drawer", true)
      .maybeSingle();
    printer = (data as PrinterPick | null) ?? null;
  }
  if (!printer) {
    const { data } = await (svc as any)
      .from("printers")
      .select("id")
      .eq("merchant_id", merchantId)
      .eq("active", true)
      .eq("supports_cash_drawer", true)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    printer = (data as PrinterPick | null) ?? null;
  }
  if (!printer) {
    return NextResponse.json(
      { ok: false, error: "No cash-drawer-capable printer configured." },
      { status: 412 },
    );
  }

  const { error: insErr } = await (svc as any).from("print_jobs").insert({
    merchant_id: merchantId,
    order_id: null,
    printer_id: printer.id,
    status: "queued",
    payload: DRAWER_ONLY_EPOS,
    kick_drawer: true,
    job_type: "drawer_pop",
  });
  if (insErr) {
    console.error("[printers/kick] insert failed", insErr.message);
    return NextResponse.json(
      { ok: false, error: safeErrorMessage(insErr.message, "Failed to queue drawer pop.") },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
