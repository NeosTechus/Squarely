import type { PublishSaleInput } from "@squarely/types";
import type { PaymentProvider, PaymentStatus, PublishSaleResult } from "./provider";

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  environment?: string; // "sandbox" | "live"
}

/**
 * PayPal. In-person card-present is via the PayPal Zettle SDK (native); this
 * REST adapter implements the Orders API (card-not-present / pay-by-link), which
 * is the server-driven path PayPal exposes. publishSale creates an order; the
 * customer approves, then checkStatus captures/confirms.
 */
export class PayPalProvider implements PaymentProvider {
  readonly name = "valor" as const;
  constructor(private cfg: PayPalConfig) {}

  private base() {
    return this.cfg.environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  }

  private async token(): Promise<string | null> {
    const res = await fetch(`${this.base()}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    return json.access_token ?? null;
  }

  async publishSale(input: PublishSaleInput): Promise<PublishSaleResult> {
    const tok = await this.token();
    if (!tok) return { ok: false, provider_payment_id: null, poll_token: null, error: "PayPal auth failed." };
    const res = await fetch(`${this.base()}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          { reference_id: input.order_id, amount: { currency_code: input.currency, value: ((input.amount_cents + input.tip_cents) / 100).toFixed(2) } },
        ],
      }),
    });
    const json = (await res.json()) as any;
    if (!res.ok || !json.id) return { ok: false, provider_payment_id: null, poll_token: null, error: json?.message ?? `PayPal HTTP ${res.status}` };
    return { ok: true, provider_payment_id: json.id, poll_token: json.id };
  }

  async checkStatus(pollToken: string): Promise<PaymentStatus> {
    const tok = await this.token();
    if (!tok) return { status: "pending", amount_cents: null, masked_pan: null, card_brand: null, auth_code: null, rrn: null, raw: null };
    // Attempt capture; succeeds only once the buyer has approved.
    const res = await fetch(`${this.base()}/v2/checkout/orders/${pollToken}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    });
    const json = (await res.json()) as any;
    const status = String(json?.status ?? "");
    return {
      status: status === "COMPLETED" ? "succeeded" : res.status === 422 ? "pending" : status === "VOIDED" ? "cancelled" : "pending",
      amount_cents: null,
      masked_pan: null,
      card_brand: null,
      auth_code: null,
      rrn: null,
      raw: json,
    };
  }
  async cancel(): Promise<{ ok: boolean }> {
    return { ok: false };
  }
  async refund(paymentId: string, amountCents: number) {
    void paymentId;
    void amountCents;
    return { ok: false, error: "Refund not implemented for PayPal adapter." };
  }
}
