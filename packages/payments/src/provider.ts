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
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  publishSale(input: PublishSaleInput): Promise<PublishSaleResult>;
  checkStatus(pollToken: string, opts?: { merchantId: string; terminalId: string }): Promise<PaymentStatus>;
  cancel(pollToken: string, opts?: { merchantId: string; terminalId: string }): Promise<{ ok: boolean }>;
  refund(paymentId: string, amountCents: number): Promise<{ ok: boolean; refund_id?: string; error?: string }>;
}
