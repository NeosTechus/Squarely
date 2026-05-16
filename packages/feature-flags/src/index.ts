import {
  PLAN_FEATURES,
  PLAN_DEVICE_LIMITS,
  type PlanFeature,
  type PlanTier,
  type Subscription,
} from "@squarely/types";

export interface ActivePlanContext {
  tier: PlanTier;
  subscription: Subscription | null;
}

export function isActive(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  return ["trialing", "active"].includes(subscription.status);
}

export function hasFeature(ctx: ActivePlanContext, feature: PlanFeature): boolean {
  if (!isActive(ctx.subscription)) {
    return feature === "pos";
  }
  return PLAN_FEATURES[ctx.tier].includes(feature);
}

export function deviceLimit(ctx: ActivePlanContext): number | null {
  return PLAN_DEVICE_LIMITS[ctx.tier];
}

export function gateError(feature: PlanFeature): string {
  return `This feature (${feature}) requires a higher plan. Upgrade in Settings → Billing.`;
}
