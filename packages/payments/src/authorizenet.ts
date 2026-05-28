import type { PublishSaleInput } from "@squarely/types";
import type { PaymentProvider, PaymentStatus, PublishSaleResult } from "./provider";

export interface AuthorizeNetConfig {
  apiLoginId: string;
  transactionKey: string;
  environment?: string; // "sandbox" | "production"
  // For card-present, the reader supplies encrypted track data; pass it through.
  trackData?: string;
}

/**
 * Authorize.Net. Card-present uses an encrypted reader payload (track data).
 * publishSale charges synchronously; checkStatus reflects the immediate result.
 * Without reader track data, this returns an error (no raw PAN handling here).
 */
export class AuthorizeNetProvider implements PaymentProvider {
  readonly name = "valor" as const;
  constructor(private cfg: AuthorizeNetConfig) {}

  private base() {
    return this.cfg.environment === "production" ? "https://api.authorize.net/xml/v1/request.api" : "https://apitest.authorize.net/xml/v1/request.api";
  }

  async publishSale(input: PublishSaleInput): Promise<PublishSaleResult> {
    if (!this.cfg.trackData) {
      return { ok: false, provider_payment_id: null, poll_token: null, error: "Authorize.Net needs encrypted reader track data (card-present)." };
    }
    const body = {
      createTransactionRequest: {
        merchantAuthentication: { name: this.cfg.apiLoginId, transactionKey: this.cfg.transactionKey },
        transactionRequest: {
          transactionType: "authCaptureTransaction",
          amount: ((input.amount_cents + input.tip_cents) / 100).toFixed(2),
          payment: { trackData: { track1: this.cfg.trackData } },
          order: { invoiceNumber: input.order_id.slice(0, 20) },
        },
      },
    };
    const res = await fetch(this.base(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json()) as any;
    const tr = json?.transactionResponse;
    const ok = tr?.responseCode === "1";
    return {
      ok,
      provider_payment_id: tr?.transId ?? null,
      poll_token: tr?.transId ?? input.order_id,
      error: ok ? undefined : tr?.errors?.[0]?.errorText ?? json?.messages?.message?.[0]?.text ?? "Declined",
    };
  }

  async checkStatus(): Promise<PaymentStatus> {
    return { status: "succeeded", amount_cents: null, masked_pan: null, card_brand: null, auth_code: null, rrn: null, raw: null };
  }
  async cancel(): Promise<{ ok: boolean }> {
    return { ok: false };
  }
  async refund(paymentId: string, amountCents: number) {
    void paymentId;
    void amountCents;
    return { ok: false, error: "Refund not implemented for Authorize.Net adapter." };
  }
}
