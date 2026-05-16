// deno-lint-ignore-file
import { corsHeaders, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const url = new URL(req.url);
  const orderId = url.searchParams.get("order_id");
  const epi = url.searchParams.get("epi");
  if (!orderId) {
    return new Response("order_id required", { status: 400, headers: corsHeaders });
  }
  const apiKey = Deno.env.get("VALOR_API_KEY");
  const apiBase = Deno.env.get("VALOR_API_BASE") ?? "https://api.valorpaytech.com";

  const res = await fetch(
    `${apiBase}/transactions/status?order_id=${orderId}${epi ? `&epi=${epi}` : ""}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  const json = await res.json().catch(() => ({}));
  return new Response(JSON.stringify(json), {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
