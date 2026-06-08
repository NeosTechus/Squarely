import type { PublishSaleInput } from "@squarely/types";

export type PaymentProviderName = "valor" | "stripe_terminal" | "square_reader";

export interface PublishSaleResult {
  ok: boolean;
  provider_payment_id: string | null;
  /** Polling token / orderId for subsequent status calls (Valor "order_id"). */
  poll_token: string | null;
  error?: string;
}

export interface PaymentStatus {
  status: "pending" | "succeeded" | "failed" | "cancelled";
  amount_cents: number | null;
  masked_pan: string | null;
  card_brand: string | null;
  auth_code: string | null;
  rrn: string | null;
  /**
   * The raw provider response payload, for server-side logging/debugging only.
   *
   * SECURITY: This MUST NEVER be spread into an HTTP response or otherwise
   * returned to a client. Provider payloads (Adyen, Authorize.Net, Clover,
   * Stripe Terminal, Valor, etc.) can contain card BIN data, full auth codes,
   * internal provider ids, idempotency keys, and provider-side URLs. Callers
   * in app routes must whitelist only the typed fields above (status,
   * masked_pan, card_brand, ...) when shaping their response.
   *
   * If you find yourself wanting to forward `raw`, log it server-side instead.
   */
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  publishSale(input: PublishSaleInput): Promise<PublishSaleResult>;
  checkStatus(pollToken: string, opts?: { merchantId: string; terminalId: string }): Promise<PaymentStatus>;
  cancel(pollToken: string, opts?: { merchantId: string; terminalId: string }): Promise<{ ok: boolean }>;
  /**
   * Refund a payment. `currency` is the originating order/payment currency
   * (ISO-4217) and is REQUIRED at the type level — callers must thread the
   * value through from the order/merchant so adapters never default to a
   * hardcoded value like "USD".
   *
   * Adapters whose upstream API derives the currency from the original
   * payment (Stripe, Clover, Authorize.Net, PayPal) MUST accept-and-ignore
   * the parameter (`void currency;`) — they still satisfy the interface but
   * never put it on the wire. Adapters that DO put it on the wire (Square,
   * Adyen, Valor) rely on the type system to keep the call site safe — no
   * runtime guard required.
   */
  refund(paymentId: string, amountCents: number, currency: string): Promise<{ ok: boolean; refund_id?: string; error?: string }>;
}
