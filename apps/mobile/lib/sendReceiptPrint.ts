import { supabase } from "./supabase";

const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL ?? "https://squarely-admin.vercel.app";

// Mirrors sendReceiptEmail / sendReceiptSms — same shape so the UI can reuse
// the email/SMS pattern (loading + status banner). The dispatch route enqueues
// the ESC-POS XML into print_jobs; actual paper-out is handled by a follow-up
// local agent or by the device itself when it shares the printer's LAN.
export type SendReceiptResult = { ok: true } | { ok: false; error: string };

export async function sendReceiptPrint(opts: {
  orderId: string;
  printerId?: string;
}): Promise<SendReceiptResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "Not signed in." };

  try {
    const res = await fetch(`${ADMIN_URL}/api/printers/dispatch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId: opts.orderId,
        ...(opts.printerId ? { printerId: opts.printerId } : {}),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };
    if (!res.ok || !body.ok) {
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
