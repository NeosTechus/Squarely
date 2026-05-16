// deno-lint-ignore-file
// RevenueCat → Supabase entitlement sync. Mobile-purchased subscriptions
// flow through here so the `subscriptions` table stays the source of truth.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // RevenueCat sends a Bearer token you configure.
  const auth = req.headers.get("authorization");
  const expected = Deno.env.get("REVENUECAT_WEBHOOK_TOKEN");
  if (expected && auth !== `Bearer ${expected}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await req.json();
  const event = body.event;
  const merchantId = event?.subscriber_attributes?.merchant_id?.value;
  if (!merchantId) return new Response("ok", { status: 200 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const status =
    event.type === "CANCELLATION" || event.type === "EXPIRATION"
      ? "canceled"
      : "active";

  await supabase.from("subscriptions").upsert(
    {
      merchant_id: merchantId,
      revenuecat_entitlement: event.entitlement_id,
      status,
      current_period_start: new Date(event.event_timestamp_ms).toISOString(),
      current_period_end: new Date(event.expiration_at_ms ?? Date.now()).toISOString(),
    },
    { onConflict: "revenuecat_entitlement" },
  );

  return new Response("ok");
});
