import { z } from "zod";

export const Allergen = z.enum([
  "milk",
  "egg",
  "fish",
  "shellfish",
  "tree_nut",
  "peanut",
  "wheat",
  "soy",
  "sesame",
  "gluten",
]);
export type Allergen = z.infer<typeof Allergen>;

export const Category = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  name: z.string().min(1).max(80),
  display_order: z.number().int().default(0),
  image_url: z.string().url().nullable(),
  active: z.boolean().default(true),
});
export type Category = z.infer<typeof Category>;

export const ModifierOption = z.object({
  id: z.string().uuid(),
  group_id: z.string().uuid(),
  name: z.string().min(1).max(80),
  price_delta_cents: z.number().int().default(0),
  display_order: z.number().int().default(0),
  active: z.boolean().default(true),
});
export type ModifierOption = z.infer<typeof ModifierOption>;

export const ModifierGroup = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  name: z.string().min(1).max(80),
  required: z.boolean().default(false),
  max_select: z.number().int().min(1).default(1),
  display_order: z.number().int().default(0),
});
export type ModifierGroup = z.infer<typeof ModifierGroup>;

export const Item = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  category_id: z.string().uuid().nullable(),
  name: z.string().min(1).max(120),
  description: z.string().nullable(),
  price_cents: z.number().int().min(0),
  image_url: z.string().url().nullable(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  allergens: z.array(Allergen).default([]),
  pos_only: z.boolean().default(false),
  kiosk_only: z.boolean().default(false),
  active: z.boolean().default(true),
  display_order: z.number().int().default(0),
  modifier_group_ids: z.array(z.string().uuid()).default([]),
  created_at: z.string().datetime(),
});
export type Item = z.infer<typeof Item>;

export const InventoryLevel = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  item_id: z.string().uuid(),
  location_id: z.string().uuid(),
  quantity: z.number(),
  reorder_threshold: z.number().nullable(),
  updated_at: z.string().datetime(),
});
export type InventoryLevel = z.infer<typeof InventoryLevel>;
