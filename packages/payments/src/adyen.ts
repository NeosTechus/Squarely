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

  async checkStatus(pollToken: string, _opts?: { merchantId: string; terminalId: string }): Promise<PaymentStatus> {
    // Re-query Adyen Terminal API via TransactionStatus. The poll_token issued
    // by publishSale is the original ServiceID; that's what keys the lookup
    // along with SaleID + POIID.
    void _opts;
    const empty: PaymentStatus = { status: "pending", amount_cents: null, masked_pan: null, card_brand: null, auth_code: null, rrn: null, raw: null };
    if (!this.cfg.poiId || !pollToken) return empty;
    const body = {
      SaleToPOIRequest: {
        MessageHeader: {
          ProtocolVersion: "3.0",
          MessageClass: "Service",
          MessageCategory: "TransactionStatus",
          MessageType: "Request",
          SaleID: "squarely",
          ServiceID: this.serviceId(),
          POIID: this.cfg.poiId,
        },
        TransactionStatusRequest: {
          MessageReference: {
            MessageCategory: "Payment",
            SaleID: "squarely",
            ServiceID: pollToken,
          },
        },
      },
    };
    let json: any = null;
    try {
      const res = await fetch(`${this.base()}/sync`, { method: "POST", headers: this.headers(), body: JSON.stringify(body) });
      json = await res.json().catch(() => null);
      if (!res.ok) return { ...empty, raw: json };
    } catch {
      return empty;
    }
    const tsr = json?.SaleToPOIResponse?.TransactionStatusResponse;
    const outer = tsr?.Response?.Result;
    // Adyen wraps the original PaymentResponse inside RepeatedMessageResponse.
    const payResp =
      tsr?.RepeatedMessageResponse?.RepeatedResponseMessageBody?.PaymentResponse;
    const inner = payResp?.Response?.Result;
    const condition = payResp?.Response?.ErrorCondition ?? tsr?.Response?.ErrorCondition;

    let status: PaymentStatus["status"] = "pending";
    if (inner === "Success") status = "succeeded";
    else if (inner === "Failure") {
      status = condition === "Cancel" || condition === "Aborted" ? "cancelled" : "failed";
    } else if (outer === "Failure" && condition === "InProgress") {
      status = "pending";
    } else if (outer === "Failure") {
      // Definitive terminal failure from the status read itself (not the sale).
      // Keep as pending unless the inner payment explicitly resolved — never
      // promote to "succeeded" without confirmation.
      status = "pending";
    }

    const amountAuth = payResp?.PaymentResult?.AmountsResp?.AuthorizedAmount;
    const card = payResp?.PaymentResult?.PaymentInstrumentData?.CardData;
    return {
      status,
      amount_cents: typeof amountAuth === "number" ? Math.round(amountAuth * 100) : null,
      masked_pan: card?.MaskedPan ?? null,
      card_brand: card?.PaymentBrand ?? null,
      auth_code: payResp?.PaymentResult?.PaymentAcquirerData?.ApprovalCode ?? null,
      rrn: null,
      raw: json,
    };
  }

  async cancel(): Promise<{ ok: boolean }> {
    return { ok: false };
  }

  async refund(paymentId: string, amountCents: number, currency?: string) {
    if (!currency) {
      return { ok: false, error: "Adyen refund requires the original payment currency." };
    }
    const res = await fetch(`https://checkout-${this.cfg.environment === "live" ? "live" : "test"}.adyen.com/v71/payments/${paymentId}/refunds`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ merchantAccount: this.cfg.merchantAccount, amount: { currency, value: amountCents } }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = (await res.json()) as any;
    return { ok: true, refund_id: json.pspReference };
  }
}
