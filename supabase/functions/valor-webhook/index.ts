// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const payload = await req.json();

  // Record raw event for audit / replay.
  const orderId = payload.order_id as string | undefined;
  const order = orderId
    ? (await supabase.from("orders").select("id, merchant_id").eq("id", orderId).maybeSingle()).data
    : null;
  if (!order) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  await supabase.from("payment_events").insert({
    merchant_id: order.merchant_id,
    provider: "valor",
    kind: "webhook_received",
    payload,
  });

  const succeeded = payload.status === "approved" || payload.status === "succeeded";
  if (succeeded) {
    await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        payment_method: "card",
      })
      .eq("id", orderId);
    await supabase.from("payments").insert({
      merchant_id: order.merchant_id,
      order_id: orderId,
      provider: "valor",
      provider_payment_id: payload.transaction_id ?? null,
      amount_cents: Math.round((payload.amount ?? 0) * 100),
      tip_cents: Math.round((payload.tip ?? 0) * 100),
      currency: payload.currency ?? "USD",
      status: "succeeded",
      masked_pan: payload.masked_pan ?? null,
      card_brand: payload.card_brand ?? null,
      auth_code: payload.auth_code ?? null,
      rrn: payload.rrn ?? null,
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
