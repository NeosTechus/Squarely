import Stripe from "stripe";
import type { PlanTier } from "@squarely/types";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2024-12-18.acacia" });
}

export interface CheckoutSessionArgs {
  merchantId: string;
  email: string;
  planTier: PlanTier;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}

export async function createCheckoutSession(args: CheckoutSessionArgs) {
  const stripe = getStripe();
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: args.email,
    line_items: [{ price: args.priceId, quantity: 1 }],
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    subscription_data: {
      metadata: { merchant_id: args.merchantId, plan_tier: args.planTier },
      trial_period_days: args.trialDays,
    },
    metadata: { merchant_id: args.merchantId, plan_tier: args.planTier },
    allow_promotion_codes: true,
  });
}

export async function createCustomerPortalSession(opts: {
  customerId: string;
  returnUrl: string;
}) {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: opts.customerId,
    return_url: opts.returnUrl,
  });
}

/**
 * Resolves a Stripe webhook subscription event into the shape we persist into
 * Supabase's `subscriptions` table. Map call this from the Stripe webhook
 * handler.
 */
export function subscriptionFromStripeEvent(sub: Stripe.Subscription) {
  return {
    stripe_subscription_id: sub.id,
    status: sub.status,
    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    merchant_id: sub.metadata.merchant_id,
    plan_tier: sub.metadata.plan_tier as PlanTier,
  };
}
