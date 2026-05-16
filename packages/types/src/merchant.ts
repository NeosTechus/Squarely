import { z } from "zod";

export const MerchantRole = z.enum([
  "owner",
  "admin",
  "manager",
  "cashier",
  "kitchen",
  "viewer",
]);
export type MerchantRole = z.infer<typeof MerchantRole>;

export const Merchant = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  slug: z.string().min(2).max(40),
  email: z.string().email(),
  phone: z.string().nullable(),
  address_line1: z.string().nullable(),
  address_line2: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postal_code: z.string().nullable(),
  country: z.string().length(2).default("US"),
  currency: z.string().length(3).default("USD"),
  timezone: z.string().default("America/New_York"),
  logo_url: z.string().url().nullable(),
  tax_rate_bps: z.number().int().min(0).max(10000).default(0),
  card_surcharge_bps: z.number().int().min(0).max(10000).default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Merchant = z.infer<typeof Merchant>;

export const MerchantMember = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: MerchantRole,
  display_name: z.string().nullable(),
  pin_hash: z.string().nullable(),
  active: z.boolean().default(true),
  created_at: z.string().datetime(),
});
export type MerchantMember = z.infer<typeof MerchantMember>;
