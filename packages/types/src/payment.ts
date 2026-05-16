import { z } from "zod";

export const PaymentProvider = z.enum(["valor", "stripe_terminal", "square_reader", "cash", "manual"]);
export type PaymentProvider = z.infer<typeof PaymentProvider>;

export const PaymentEventKind = z.enum([
  "created",
  "authorized",
  "captured",
  "failed",
  "voided",
  "refunded",
  "webhook_received",
]);
export type PaymentEventKind = z.infer<typeof PaymentEventKind>;

export const Payment = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  order_id: z.string().uuid(),
  provider: PaymentProvider,
  provider_payment_id: z.string().nullable(),
  amount_cents: z.number().int().min(0),
  tip_cents: z.number().int().min(0).default(0),
  currency: z.string().length(3),
  status: z.enum(["pending", "succeeded", "failed", "refunded", "voided"]),
  masked_pan: z.string().nullable(),
  card_brand: z.string().nullable(),
  auth_code: z.string().nullable(),
  rrn: z.string().nullable(),
  terminal_id: z.string().uuid().nullable(),
  receipt_url: z.string().url().nullable(),
  created_at: z.string().datetime(),
});
export type Payment = z.infer<typeof Payment>;

export const PaymentEvent = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  payment_id: z.string().uuid().nullable(),
  kind: PaymentEventKind,
  payload: z.record(z.unknown()),
  provider: PaymentProvider,
  created_at: z.string().datetime(),
});
export type PaymentEvent = z.infer<typeof PaymentEvent>;

export const PublishSaleInput = z.object({
  merchant_id: z.string().uuid(),
  order_id: z.string().uuid(),
  terminal_id: z.string().uuid(),
  amount_cents: z.number().int().min(1),
  tip_cents: z.number().int().min(0).default(0),
  currency: z.string().length(3).default("USD"),
});
export type PublishSaleInput = z.infer<typeof PublishSaleInput>;
