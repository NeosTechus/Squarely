import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { subscriptionFromStripeEvent } from "@squarely/billing";
import { getServiceSupabase } from "@/lib/supabase";
import { verifyWebhook } from "@/lib/webhookSignature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Signature verification is delegated to the shared harness so the policy
  // (constant-time compare, no internal detail in the response, single body
  // read) is enforced in one place for every future webhook too.
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const result = await verifyWebhook<Stripe.Event>(req, { kind: "stripe", secret });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const event = result.payload;

  const supabase = getServiceSupabase();

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const row = subscriptionFromStripeEvent(sub);
      if (!row.merchant_id) break;
      await (supabase as any).from("subscriptions").upsert({
        merchant_id: row.merchant_id,
        stripe_subscription_id: row.stripe_subscription_id,
        status: row.status,
        current_period_start: row.current_period_start,
        current_period_end: row.current_period_end,
        cancel_at: row.cancel_at,
        trial_end: row.trial_end,
      }, { onConflict: "stripe_subscription_id" });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
