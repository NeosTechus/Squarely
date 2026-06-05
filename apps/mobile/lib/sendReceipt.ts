import { supabase } from "./supabase";

const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL ?? "https://squarely-admin.vercel.app";

export type SendReceiptResult = { ok: true } | { ok: false; error: string };

// Both senders share the same auth flow (session JWT bearer) and result shape;
// the only thing that differs is the route and the body payload.
async function postReceipt(path: string, payload: Record<string, string>): Promise<SendReceiptResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "Not signed in." };

  try {
    const res = await fetch(`${ADMIN_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !body.ok) {
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function sendReceiptEmail(opts: { orderId: string; email: string }): Promise<SendReceiptResult> {
  return postReceipt("/api/receipts/email", { orderId: opts.orderId, email: opts.email });
}

export function sendReceiptSms(opts: { orderId: string; phone: string }): Promise<SendReceiptResult> {
  return postReceipt("/api/receipts/sms", { orderId: opts.orderId, phone: opts.phone });
}
