import type { Order, OrderItem } from "@squarely/types";

export interface PricingConfig {
  taxRateBps: number;
  cardSurchargeBps: number;
  /** When true, surcharge applies only to card payments. */
  surchargeOnCardOnly: boolean;
}

export interface CartLine {
  unit_price_cents: number;
  quantity: number;
  modifier_total_cents?: number;
}

export interface ComputedTotals {
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  surcharge_cents: number;
  tip_cents: number;
  total_cents: number;
}

export function lineTotal(line: CartLine): number {
  return (line.unit_price_cents + (line.modifier_total_cents ?? 0)) * line.quantity;
}

export interface ComputeTotalsArgs {
  lines: CartLine[];
  config: PricingConfig;
  discount_cents?: number;
  tip_cents?: number;
  payment_method?: "card" | "cash" | "split" | "other";
}

export function computeTotals(args: ComputeTotalsArgs): ComputedTotals {
  const subtotal = args.lines.reduce((s, l) => s + lineTotal(l), 0);
  const discount = Math.min(args.discount_cents ?? 0, subtotal);
  const taxBase = subtotal - discount;
  const tax = Math.round((taxBase * args.config.taxRateBps) / 10000);
  const wantSurcharge = !args.config.surchargeOnCardOnly || args.payment_method === "card";
  const surcharge = wantSurcharge
    ? Math.round((taxBase * args.config.cardSurchargeBps) / 10000)
    : 0;
  const tip = args.tip_cents ?? 0;
  return {
    subtotal_cents: subtotal,
    discount_cents: discount,
    tax_cents: tax,
    surcharge_cents: surcharge,
    tip_cents: tip,
    total_cents: taxBase + tax + surcharge + tip,
  };
}

export function orderItemsToCartLines(items: OrderItem[]): CartLine[] {
  return items.map((i) => ({
    unit_price_cents: i.unit_price_cents,
    quantity: i.quantity,
    modifier_total_cents: i.modifiers.reduce((s, m) => s + m.price_delta_cents, 0),
  }));
}

export function recomputeOrder(order: Order, config: PricingConfig): ComputedTotals {
  return computeTotals({
    lines: orderItemsToCartLines(order.items),
    config,
    discount_cents: order.discount_cents,
    tip_cents: order.tip_cents,
    payment_method: order.payment_method ?? undefined,
  });
}
