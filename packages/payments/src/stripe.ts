import type { PublishSaleInput } from "@squarely/types";
import type { PaymentProvider, PaymentStatus, PublishSaleResult } from "./provider";

export interface StripeConfig {
  secretKey: string;
  readerId?: string;
}

/** Stripe Terminal (server-driven internet readers, e.g. WisePOS E). */
export class StripeProvider implements PaymentProvider {
  readonly name = "stripe_terminal" as const;
  constructor(private cfg: StripeConfig) {}

  private async api(path: string, method: string, form?: Record<string, string>) {
    const res = await fetch(`https://api.stripe.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.cfg.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
    return { ok: res.ok, json: (await res.json()) as any, status: res.status };
  }

  async publishSale(input: PublishSaleInput): Promise<PublishSaleResult> {
    if (!this.cfg.readerId) return { ok: false, provider_payment_id: null, poll_token: null, error: "No Stripe reader id configured." };
    // 1. PaymentIntent for card_present
    const pi = await this.api("/v1/payment_intents", "POST", {
      amount: String(input.amount_cents + input.tip_cents),
      currency: input.currency.toLowerCase(),
      "payment_method_types[]": "card_present",
      capture_method: "automatic",
      description: `Order ${input.order_id}`,
    });
    if (!pi.ok) return { ok: false, provider_payment_id: null, poll_token: null, error: pi.json?.error?.message ?? `Stripe HTTP ${pi.status}` };
    const piId = pi.json.id as string;
    // 2. Hand it to the reader
    const proc = await this.api(`/v1/terminal/readers/${this.cfg.readerId}/process_payment_intent`, "POST", {
      payment_intent: piId,
    });
    if (!proc.ok) return { ok: false, provider_payment_id: piId, poll_token: piId, error: proc.json?.error?.message ?? `Stripe reader HTTP ${proc.status}` };
    return { ok: true, provider_payment_id: piId, poll_token: piId };
  }

  async checkStatus(pollToken: string): Promise<PaymentStatus> {
    const r = await this.api(`/v1/payment_intents/${pollToken}`, "GET");
    const s = String(r.json.status ?? "processing");
    return {
      status:
        s === "succeeded" ? "succeeded" : s === "canceled" ? "cancelled" : s === "requires_payment_method" && r.json.last_payment_error ? "failed" : "pending",
      amount_cents: r.json.amount ?? null,
      masked_pan: null,
      card_brand: null,
      auth_code: null,
      rrn: null,
      raw: r.json,
    };
  }

  async cancel(pollToken: string): Promise<{ ok: boolean }> {
    const r = await this.api(`/v1/payment_intents/${pollToken}/cancel`, "POST");
    return { ok: r.ok };
  }

  async refund(paymentId: string, amountCents: number) {
    const r = await this.api("/v1/refunds", "POST", { payment_intent: paymentId, amount: String(amountCents) });
    if (!r.ok) return { ok: false, error: r.json?.error?.message ?? `HTTP ${r.status}` };
    return { ok: true, refund_id: r.json.id };
  }
}
