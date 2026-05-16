import { z } from "zod";

export const PlanTier = z.enum(["starter", "growth", "pro", "enterprise"]);
export type PlanTier = z.infer<typeof PlanTier>;

export const PlanFeature = z.enum([
  "pos",
  "kiosk",
  "kds",
  "inventory_basic",
  "inventory_full",
  "loyalty",
  "multi_location",
  "advanced_reports",
  "api_access",
  "white_label",
]);
export type PlanFeature = z.infer<typeof PlanFeature>;

export const Plan = z.object({
  id: z.string().uuid(),
  tier: PlanTier,
  display_name: z.string(),
  monthly_price_cents: z.number().int().min(0),
  yearly_price_cents: z.number().int().min(0),
  device_limit: z.number().int().min(1).nullable(),
  features: z.array(PlanFeature),
  stripe_price_id_monthly: z.string().nullable(),
  stripe_price_id_yearly: z.string().nullable(),
});
export type Plan = z.infer<typeof Plan>;

export const SubscriptionStatus = z.enum([
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "paused",
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;

export const Subscription = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  status: SubscriptionStatus,
  stripe_subscription_id: z.string().nullable(),
  revenuecat_entitlement: z.string().nullable(),
  current_period_start: z.string().datetime(),
  current_period_end: z.string().datetime(),
  cancel_at: z.string().datetime().nullable(),
  trial_end: z.string().datetime().nullable(),
});
export type Subscription = z.infer<typeof Subscription>;

export const PLAN_FEATURES: Record<PlanTier, PlanFeature[]> = {
  starter: ["pos", "inventory_basic"],
  growth: ["pos", "kiosk", "inventory_full"],
  pro: [
    "pos",
    "kiosk",
    "kds",
    "inventory_full",
    "loyalty",
    "multi_location",
    "advanced_reports",
  ],
  enterprise: [
    "pos",
    "kiosk",
    "kds",
    "inventory_full",
    "loyalty",
    "multi_location",
    "advanced_reports",
    "api_access",
    "white_label",
  ],
};

export const PLAN_DEVICE_LIMITS: Record<PlanTier, number | null> = {
  starter: 1,
  growth: 3,
  pro: 10,
  enterprise: null,
};
