// deno-lint-ignore-file
// On order_paid: grant loyalty points (1 point per dollar by default).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const { order_id } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: order } = await supabase
    .from("orders")
    .select("id, merchant_id, customer_id, total_cents")
    .eq("id", order_id)
    .single();
  if (!order || !order.customer_id) return new Response("ok");

  const points = Math.floor(order.total_cents / 100);
  if (points <= 0) return new Response("ok");

  const { data: account } = await supabase
    .from("loyalty_accounts")
    .upsert(
      {
        merchant_id: order.merchant_id,
        customer_id: order.customer_id,
        points_balance: 0,
        lifetime_points: 0,
      },
      { onConflict: "customer_id", ignoreDuplicates: true },
    )
    .select()
    .single();

  if (account) {
    await supabase.from("loyalty_transactions").insert({
      merchant_id: order.merchant_id,
      account_id: account.id,
      order_id: order.id,
      delta: points,
      reason: "earn",
    });
    await supabase
      .from("loyalty_accounts")
      .update({
        points_balance: account.points_balance + points,
        lifetime_points: account.lifetime_points + points,
      })
      .eq("id", account.id);
  }
  return new Response("ok");
});
