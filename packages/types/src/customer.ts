import { z } from "zod";

export const Customer = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  display_name: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string().datetime(),
});
export type Customer = z.infer<typeof Customer>;

export const LoyaltyAccount = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  points_balance: z.number().int().default(0),
  lifetime_points: z.number().int().default(0),
  tier: z.string().nullable(),
});
export type LoyaltyAccount = z.infer<typeof LoyaltyAccount>;

export const LoyaltyTransaction = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  account_id: z.string().uuid(),
  order_id: z.string().uuid().nullable(),
  delta: z.number().int(),
  reason: z.enum(["earn", "redeem", "adjust", "expire"]),
  created_at: z.string().datetime(),
});
export type LoyaltyTransaction = z.infer<typeof LoyaltyTransaction>;
