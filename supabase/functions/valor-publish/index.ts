// deno-lint-ignore-file
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  const body = await req.json();
  const apiKey = Deno.env.get("VALOR_API_KEY");
  const apiBase = Deno.env.get("VALOR_API_BASE") ?? "https://api.valorpaytech.com";
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "VALOR_API_KEY not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const res = await fetch(`${apiBase}/transactions/sale`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      epi: body.terminal_epi,
      order_id: body.order_id,
      amount: body.amount,
      tip: body.tip,
      currency: body.currency ?? "USD",
    }),
  });

  const json = await res.json().catch(() => ({}));
  return new Response(JSON.stringify(json), {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
