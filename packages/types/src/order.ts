import { z } from "zod";

export const OrderSource = z.enum(["pos", "kiosk", "web", "api"]);
export type OrderSource = z.infer<typeof OrderSource>;

export const OrderType = z.enum([
  "pickup",
  "delivery",
  "dine_in",
  "take_out",
]);
export type OrderType = z.infer<typeof OrderType>;

export const OrderStatus = z.enum([
  "pending",
  "received",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const PaymentMethod = z.enum(["card", "cash", "split", "other"]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const PaymentStatus = z.enum([
  "unpaid",
  "paid",
  "refunded",
  "partial_refund",
  "voided",
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const OrderItemModifier = z.object({
  id: z.string().uuid(),
  order_item_id: z.string().uuid(),
  modifier_group_id: z.string().uuid(),
  modifier_option_id: z.string().uuid(),
  name_snapshot: z.string(),
  price_delta_cents: z.number().int(),
});
export type OrderItemModifier = z.infer<typeof OrderItemModifier>;

export const OrderItem = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  item_id: z.string().uuid().nullable(),
  name_snapshot: z.string(),
  unit_price_cents: z.number().int(),
  quantity: z.number().int().min(1),
  notes: z.string().nullable(),
  modifiers: z.array(OrderItemModifier).default([]),
});
export type OrderItem = z.infer<typeof OrderItem>;

export const Order = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  location_id: z.string().uuid().nullable(),
  number: z.number().int().min(0),
  source: OrderSource,
  order_type: OrderType,
  status: OrderStatus,
  customer_id: z.string().uuid().nullable(),
  customer_name: z.string().nullable(),
  customer_email: z.string().email().nullable(),
  customer_phone: z.string().nullable(),
  subtotal_cents: z.number().int().min(0),
  tax_cents: z.number().int().min(0),
  surcharge_cents: z.number().int().min(0),
  tip_cents: z.number().int().min(0).default(0),
  discount_cents: z.number().int().min(0).default(0),
  total_cents: z.number().int().min(0),
  payment_method: PaymentMethod.nullable(),
  payment_status: PaymentStatus.default("unpaid"),
  terminal_id: z.string().uuid().nullable(),
  receipt_printed_at: z.string().datetime().nullable(),
  items: z.array(OrderItem).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Order = z.infer<typeof Order>;
