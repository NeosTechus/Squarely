import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getTerminalProvider } from "@squarely/payments";

/**
 * Poll a terminal charge. On success, marks the order paid (server-side).
 */
export async function POST(req: NextRequest) {
  try {
    const { merchantId, orderId, pollToken, provider } = await req.json();
    if (!merchantId || !orderId || !pollToken || !provider) {
      return NextResponse.json({ ok: false, error: "merchantId, orderId, pollToken, provider required" }, { status: 400 });
    }

    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const svc = getServiceSupabase() as any;
    const { data: u } = await svc.auth.getUser(token);
    if (!u?.user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const [{ data: admin }, { data: member }] = await Promise.all([
      svc.from("platform_admins").select("user_id").eq("user_id", u.user.id).maybeSingle(),
      svc.from("merchant_members").select("merchant_id").eq("user_id", u.user.id).eq("merchant_id", merchantId).eq("active", true).maybeSingle(),
    ]);
    if (!admin && !member) return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });

    const { data: gw } = await svc
      .from("merchant_payment_gateways")
      .select("config")
      .eq("merchant_id", merchantId)
      .eq("provider", provider)
      .maybeSingle();
    const adapter = getTerminalProvider(provider, gw?.config ?? {});
    if (!adapter) return NextResponse.json({ ok: false, error: `Unsupported provider ${provider}.` }, { status: 400 });

    const cfg = gw?.config ?? {};
    const terminalId = String(cfg.epi ?? cfg.deviceId ?? cfg.readerId ?? "");
    const st = await adapter.checkStatus(pollToken, { merchantId, terminalId });

    if (st.status === "succeeded") {
      await svc
        .from("orders")
        .update({ payment_status: "paid", payment_method: "card" })
        .eq("id", orderId);
    }

    return NextResponse.json({ ok: true, status: st.status, masked_pan: st.masked_pan, card_brand: st.card_brand });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
