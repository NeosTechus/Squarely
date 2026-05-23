import { NextResponse } from "next/server";
import { getStripe, subscriptionFromStripeEvent } from "@squarely/billing";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "missing-signature" }, { status: 400 });
  }
  const stripe = getStripe();
  const raw = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: "invalid-signature", details: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

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
