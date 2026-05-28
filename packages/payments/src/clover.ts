import type { PublishSaleInput } from "@squarely/types";
import type { PaymentProvider, PaymentStatus, PublishSaleResult } from "./provider";

export interface CloverConfig {
  merchantId: string;
  apiToken: string;
  deviceId?: string;
  environment?: string; // "sandbox" | "production"
}

/**
 * Clover. Card-present uses the Clover device (Cloud Pay Display / remote-pay).
 * This adapter implements the REST charge structure; for a physical device the
 * publishSale should be routed to the device's remote-pay endpoint with deviceId.
 */
export class CloverProvider implements PaymentProvider {
  readonly name = "valor" as const;
  constructor(private cfg: CloverConfig) {}

  private base() {
    return this.cfg.environment === "production" ? "https://api.clover.com" : "https://sandbox.dev.clover.com";
  }
  private headers() {
    return { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.apiToken}` };
  }

  async publishSale(input: PublishSaleInput): Promise<PublishSaleResult> {
    if (!this.cfg.deviceId) {
      return { ok: false, provider_payment_id: null, poll_token: null, error: "No Clover device id configured." };
    }
    // Clover device charge is initiated via the merchant's device; we record the
    // intent against the order and poll the device for the result.
    const res = await fetch(`${this.base()}/v3/merchants/${this.cfg.merchantId}/orders/${input.order_id}/pay`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ amount: input.amount_cents + input.tip_cents, deviceId: this.cfg.deviceId }),
    }).catch(() => null);
    if (!res || !res.ok) {
      return { ok: false, provider_payment_id: null, poll_token: null, error: `Clover HTTP ${res?.status ?? "network"}` };
    }
    const json = (await res.json()) as any;
    return { ok: true, provider_payment_id: json?.id ?? null, poll_token: json?.id ?? input.order_id };
  }

  async checkStatus(pollToken: string): Promise<PaymentStatus> {
    const res = await fetch(`${this.base()}/v3/merchants/${this.cfg.merchantId}/payments/${pollToken}`, { headers: this.headers() }).catch(() => null);
    if (!res || !res.ok) return { status: "pending", amount_cents: null, masked_pan: null, card_brand: null, auth_code: null, rrn: null, raw: null };
    const json = (await res.json()) as any;
    const result = String(json?.result ?? "");
    return {
      status: result === "SUCCESS" ? "succeeded" : result === "FAIL" ? "failed" : "pending",
      amount_cents: json?.amount ?? null,
      masked_pan: json?.cardTransaction?.last4 ? `•••• ${json.cardTransaction.last4}` : null,
      card_brand: json?.cardTransaction?.cardType ?? null,
      auth_code: json?.cardTransaction?.authCode ?? null,
      rrn: null,
      raw: json,
    };
  }
  async cancel(): Promise<{ ok: boolean }> {
    return { ok: false };
  }
  async refund(paymentId: string, amountCents: number) {
    const res = await fetch(`${this.base()}/v3/merchants/${this.cfg.merchantId}/refunds`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ payment: { id: paymentId }, amount: amountCents }),
    }).catch(() => null);
    if (!res || !res.ok) return { ok: false, error: `HTTP ${res?.status ?? "network"}` };
    const json = (await res.json()) as any;
    return { ok: true, refund_id: json?.id };
  }
}
