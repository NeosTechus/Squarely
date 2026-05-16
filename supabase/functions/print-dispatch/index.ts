// deno-lint-ignore-file
// Epson Server Direct Print poll/ack endpoint.
// Printers configured for SDP will poll this URL on a loop. We respond with
// any queued ePOS XML and, on ack (printjobid in headers), mark the receipt
// printed. Mirrors api/print/epson.ts from the legacy Fenton repo.

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

  const url = new URL(req.url);
  const deviceId = url.searchParams.get("devid");
  if (!deviceId) return new Response("devid required", { status: 400, headers: corsHeaders });

  // 1. Ack — printer sends back the printjobid after a successful print.
  const ackId = req.headers.get("x-printjobid");
  if (req.method === "POST" && ackId) {
    await supabase.from("receipts").update({ printed_at: new Date().toISOString() }).eq("id", ackId);
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Poll — find the oldest unprinted receipt for this device.
  const { data: printer } = await supabase
    .from("printers")
    .select("id, merchant_id")
    .eq("cloud_device_id", deviceId)
    .single();
  if (!printer) return new Response("printer not found", { status: 404, headers: corsHeaders });

  const { data: pending } = await supabase
    .from("receipts")
    .select("id, epos_xml")
    .eq("merchant_id", printer.merchant_id)
    .eq("printer_id", printer.id)
    .is("printed_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!pending) {
    return new Response("", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/xml; charset=utf-8" },
    });
  }

  return new Response(pending.epos_xml, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/xml; charset=utf-8",
      "x-printjobid": pending.id,
    },
  });
});
