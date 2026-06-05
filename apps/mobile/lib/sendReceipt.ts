import { supabase } from "./supabase";

const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL ?? "https://squarely-admin.vercel.app";

export type SendReceiptResult = { ok: true } | { ok: false; error: string };

export async function sendReceiptEmail(opts: { orderId: string; email: string }): Promise<SendReceiptResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "Not signed in." };

  try {
    const res = await fetch(`${ADMIN_URL}/api/receipts/email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: opts.orderId, email: opts.email }),
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
