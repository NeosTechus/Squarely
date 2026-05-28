import type { PublishSaleInput } from "@squarely/types";
import type { PaymentProvider, PaymentStatus, PublishSaleResult } from "./provider";

export interface SquareConfig {
  accessToken: string;
  locationId?: string;
  deviceId?: string;
  environment?: string; // "sandbox" | "production"
}

const SQUARE_VERSION = "2024-10-17";

/** Square Terminal API (server-driven card-present checkout). */
export class SquareProvider implements PaymentProvider {
  readonly name = "square_reader" as const;
  constructor(private cfg: SquareConfig) {}

  private base() {
    return this.cfg.environment === "sandbox"
      ? "https://connect.squareupsandbox.com"
      : "https://connect.squareup.com";
  }
  private headers() {
    return {
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
      Authorization: `Bearer ${this.cfg.accessToken}`,
    };
  }

  async publishSale(input: PublishSaleInput): Promise<PublishSaleResult> {
    const deviceId = this.cfg.deviceId;
    if (!deviceId) return { ok: false, provider_payment_id: null, poll_token: null, error: "No Square device id configured." };
    const res = await fetch(`${this.base()}/v2/terminals/checkouts`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        idempotency_key: `${input.order_id}-${Date.now()}`,
        checkout: {
          amount_money: { amount: input.amount_cents + input.tip_cents, currency: input.currency },
          device_options: { device_id: deviceId },
          reference_id: input.order_id,
        },
      }),
    });
    const json = (await res.json()) as any;
    if (!res.ok) {
      return { ok: false, provider_payment_id: null, poll_token: null, error: json?.errors?.[0]?.detail ?? `Square HTTP ${res.status}` };
    }
    const checkout = json.checkout;
    return { ok: true, provider_payment_id: checkout?.payment_ids?.[0] ?? null, poll_token: checkout?.id ?? null };
  }

  async checkStatus(pollToken: string): Promise<PaymentStatus> {
    const res = await fetch(`${this.base()}/v2/terminals/checkouts/${pollToken}`, { headers: this.headers() });
    const json = (await res.json()) as any;
    const c = json.checkout ?? {};
    const s = String(c.status ?? "PENDING");
    return {
      status:
        s === "COMPLETED" ? "succeeded" : s === "CANCELED" || s === "CANCEL_REQUESTED" ? "cancelled" : s === "FAILED" ? "failed" : "pending",
      amount_cents: c.amount_money?.amount ?? null,
      masked_pan: null,
      card_brand: null,
      auth_code: null,
      rrn: null,
      raw: json,
    };
  }

  async cancel(pollToken: string): Promise<{ ok: boolean }> {
    const res = await fetch(`${this.base()}/v2/terminals/checkouts/${pollToken}/cancel`, { method: "POST", headers: this.headers() });
    return { ok: res.ok };
  }

  async refund(paymentId: string, amountCents: number) {
    const res = await fetch(`${this.base()}/v2/refunds`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        idempotency_key: `${paymentId}-${Date.now()}`,
        payment_id: paymentId,
        amount_money: { amount: amountCents, currency: "USD" },
      }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = (await res.json()) as any;
    return { ok: true, refund_id: json.refund?.id };
  }
}
