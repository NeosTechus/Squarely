import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getTerminalProvider } from "@squarely/payments";

/**
 * Begin a card-present terminal charge for an existing order. Loads the
 * merchant's default enabled card gateway (server-side, with its secret keys),
 * tells the connected reader to charge, and returns a poll token. The device
 * never sees the keys.
 */
export async function POST(req: NextRequest) {
  try {
    const { merchantId, orderId, amountCents, tipCents = 0, currency = "USD" } = await req.json();
    if (!merchantId || !orderId || !amountCents) {
      return NextResponse.json({ ok: false, error: "merchantId, orderId, amountCents required" }, { status: 400 });
    }

    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const svc = getServiceSupabase() as any;
    const { data: u } = await svc.auth.getUser(token);
    if (!u?.user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    // Authorize: platform admin or active member of the merchant.
    const [{ data: admin }, { data: member }] = await Promise.all([
      svc.from("platform_admins").select("user_id").eq("user_id", u.user.id).maybeSingle(),
      svc.from("merchant_members").select("merchant_id").eq("user_id", u.user.id).eq("merchant_id", merchantId).eq("active", true).maybeSingle(),
    ]);
    if (!admin && !member) return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });

    // Pick the default enabled non-cash gateway.
    const { data: gws } = await svc
      .from("merchant_payment_gateways")
      .select("provider, config, is_default")
      .eq("merchant_id", merchantId)
      .eq("enabled", true);
    const list = (gws ?? []).filter((g: any) => g.provider !== "cash");
    const chosen = list.find((g: any) => g.is_default) ?? list[0];
    if (!chosen) return NextResponse.json({ ok: false, error: "No card gateway configured for this merchant." }, { status: 400 });

    const adapter = getTerminalProvider(chosen.provider, chosen.config ?? {});
    if (!adapter) return NextResponse.json({ ok: false, error: `Card-present not supported for ${chosen.provider}.` }, { status: 400 });

    const cfg = chosen.config ?? {};
    const terminalId = String(cfg.epi ?? cfg.deviceId ?? cfg.readerId ?? orderId);
    const result = await adapter.publishSale({
      merchant_id: merchantId,
      order_id: orderId,
      terminal_id: terminalId,
      amount_cents: amountCents,
      tip_cents: tipCents,
      currency,
    });

    return NextResponse.json({ ...result, provider: chosen.provider });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
