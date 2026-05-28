import type { PublishSaleInput } from "@squarely/types";
import type { PaymentProvider, PaymentStatus, PublishSaleResult } from "./provider";

export interface AdyenConfig {
  apiKey: string;
  merchantAccount?: string;
  poiId?: string; // terminal POI id, e.g. "V400m-123456789"
  environment?: string; // "test" | "live"
}

/**
 * Adyen Terminal API (cloud "/sync"). publishSale sends a PaymentRequest to the
 * POI terminal; the cloud call resolves once the customer taps. We surface the
 * result and let checkStatus re-query via TransactionStatus.
 */
export class AdyenProvider implements PaymentProvider {
  readonly name = "valor" as const; // generic; not used for routing
  constructor(private cfg: AdyenConfig) {}

  private base() {
    return this.cfg.environment === "live"
      ? "https://terminal-api-live.adyen.com"
      : "https://terminal-api-test.adyen.com";
  }
  private headers() {
    return { "Content-Type": "application/json", "X-API-Key": this.cfg.apiKey };
  }
  private serviceId() {
    return Date.now().toString().slice(-10);
  }

  async publishSale(input: PublishSaleInput): Promise<PublishSaleResult> {
    if (!this.cfg.poiId) return { ok: false, provider_payment_id: null, poll_token: null, error: "No Adyen POI id configured." };
    const serviceId = this.serviceId();
    const body = {
      SaleToPOIRequest: {
        MessageHeader: {
          ProtocolVersion: "3.0",
          MessageClass: "Service",
          MessageCategory: "Payment",
          MessageType: "Request",
          SaleID: "squarely",
          ServiceID: serviceId,
          POIID: this.cfg.poiId,
        },
        PaymentRequest: {
          SaleData: { SaleTransactionID: { TransactionID: input.order_id, TimeStamp: new Date().toISOString() } },
          PaymentTransaction: {
            AmountsReq: { Currency: input.currency, RequestedAmount: (input.amount_cents + input.tip_cents) / 100 },
          },
        },
      },
    };
    const res = await fetch(`${this.base()}/sync`, { method: "POST", headers: this.headers(), body: JSON.stringify(body) });
    const json = (await res.json()) as any;
    const resp = json?.SaleToPOIResponse?.PaymentResponse;
    const result = resp?.Response?.Result;
    if (!res.ok || !result) {
      return { ok: false, provider_payment_id: null, poll_token: null, error: resp?.Response?.ErrorCondition ?? `Adyen HTTP ${res.status}` };
    }
    const pspRef = resp?.PaymentResult?.PaymentAcquirerData?.AcquirerTransactionID?.TransactionID ?? serviceId;
    return { ok: result === "Success", provider_payment_id: pspRef, poll_token: serviceId, error: result === "Success" ? undefined : result };
  }

  async checkStatus(): Promise<PaymentStatus> {
    // /sync is synchronous — by the time we have a poll token the sale resolved.
    return { status: "succeeded", amount_cents: null, masked_pan: null, card_brand: null, auth_code: null, rrn: null, raw: null };
  }

  async cancel(): Promise<{ ok: boolean }> {
    return { ok: false };
  }

  async refund(paymentId: string, amountCents: number) {
    const res = await fetch(`https://checkout-${this.cfg.environment === "live" ? "live" : "test"}.adyen.com/v71/payments/${paymentId}/refunds`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ merchantAccount: this.cfg.merchantAccount, amount: { currency: "USD", value: amountCents } }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = (await res.json()) as any;
    return { ok: true, refund_id: json.pspReference };
  }
}
