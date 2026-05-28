import { supabase } from "./supabase";

/**
 * Card-present terminal charging. Calls the server endpoints on web-admin
 * (which hold the merchant's gateway secrets) — the device never sees keys.
 * Returns "paid" | "failed" | "no_gateway" (caller may fall back to recording).
 */
const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL ?? "https://squarely-admin.vercel.app";

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : null;
}

export type TerminalResult = "paid" | "failed" | "no_gateway" | "error";

export async function chargeOnTerminal(opts: {
  merchantId: string;
  orderId: string;
  amountCents: number;
  onPrompt?: () => void; // called once the reader is waiting for a tap
}): Promise<{ result: TerminalResult; error?: string }> {
  const headers = await authHeader();
  if (!headers) return { result: "error", error: "Not signed in." };

  // 1. Start the charge on the reader.
  const startRes = await fetch(`${ADMIN_URL}/api/payments/start`, {
    method: "POST",
    headers,
    body: JSON.stringify({ merchantId: opts.merchantId, orderId: opts.orderId, amountCents: opts.amountCents }),
  });
  const start = await startRes.json().catch(() => ({}));
  if (startRes.status === 400 && /no card gateway|not supported/i.test(start?.error ?? "")) {
    return { result: "no_gateway", error: start?.error };
  }
  if (!start?.ok || !start?.poll_token) {
    return { result: "error", error: start?.error ?? `HTTP ${startRes.status}` };
  }
  opts.onPrompt?.();

  // 2. Poll for the result (~90s max).
  const provider = start.provider as string;
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const stRes = await fetch(`${ADMIN_URL}/api/payments/status`, {
      method: "POST",
      headers,
      body: JSON.stringify({ merchantId: opts.merchantId, orderId: opts.orderId, pollToken: start.poll_token, provider }),
    });
    const st = await stRes.json().catch(() => ({}));
    if (st?.status === "succeeded") return { result: "paid" };
    if (st?.status === "failed" || st?.status === "cancelled") return { result: "failed", error: st?.status };
  }
  return { result: "failed", error: "Timed out waiting for the reader." };
}
