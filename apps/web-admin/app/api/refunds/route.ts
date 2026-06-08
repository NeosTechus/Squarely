import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getTerminalProvider } from "@squarely/payments";
import { safeErrorMessage } from "@/lib/redact";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/refunds
 *
 * Issue a refund against a previously paid order through the merchant's
 * configured card gateway. This is the money-out counterpart to
 * /api/payments/start: the device never sees gateway secrets, the route
 * loads the original transaction id off the order, and the refund result is
 * recorded both as an admin_audit ledger row and a `orders.payment_status`
 * transition ('refunded' for full, 'partial_refund' for partial).
 *
 * Auth/authz are tighter than the receipt-email route because this moves
 * real money:
 *   - Bearer JWT required (mirror /api/payments/start).
 *   - Caller must be a platform admin OR an active merchant_members row with
 *     role in ('owner','admin'). Cashier / manager / viewer cannot refund.
 *   - 20 requests / minute / user (refunds:<userId>). Refunds are not in any
 *     tight UI loop, so a much smaller bucket than start (60/min) or status
 *     (120/min) is appropriate.
 *
 * Body: { orderId: string; amountCents?: number; reason?: string }
 *   - amountCents defaults to the order total. Must be > 0 and <= total.
 */

interface OrderRow {
  id: string;
  merchant_id: string;
  number: number;
  total_cents: number;
  payment_method: string | null;
  payment_status: string;
  status: string;
  gateway_payment_id: string | null;
  gateway_provider: string | null;
}

interface GatewayRow {
  provider: string;
  config: Record<string, unknown> | null;
  is_default: boolean | null;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Parse + validate body.
    let body: { orderId?: string; amountCents?: number; reason?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const orderId = body.orderId?.trim();
    const reason = body.reason?.trim() || null;
    if (!orderId) {
      return NextResponse.json({ ok: false, error: "orderId required" }, { status: 400 });
    }
    if (body.amountCents !== undefined) {
      if (
        typeof body.amountCents !== "number" ||
        !Number.isFinite(body.amountCents) ||
        !Number.isInteger(body.amountCents) ||
        body.amountCents <= 0
      ) {
        return NextResponse.json(
          { ok: false, error: "amountCents must be a positive integer" },
          { status: 400 },
        );
      }
    }

    // 2. Bearer JWT.
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }
    const svc = getServiceSupabase() as any;
    const { data: u } = await svc.auth.getUser(token);
    const userId = u?.user?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    // 3. Rate limit AFTER auth so anon traffic 401s without consuming the
    //    bucket. 20/min/user is conservative — refunds are not polled.
    const rl = checkRateLimit(`refunds:${userId}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded. Please slow down." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 1) } },
      );
    }

    // 4. Load the order.
    const { data: orderRaw, error: orderErr } = await svc
      .from("orders")
      .select(
        "id, merchant_id, number, total_cents, payment_method, payment_status, status, gateway_payment_id, gateway_provider",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr || !orderRaw) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }
    const order = orderRaw as OrderRow;

    // 5. Authorize: platform admin OR active owner/admin of the merchant.
    //    Cashier / manager / viewer can record sales but cannot refund.
    const [{ data: admin }, { data: member }] = await Promise.all([
      svc.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
      svc
        .from("merchant_members")
        .select("role, active")
        .eq("merchant_id", order.merchant_id)
        .eq("user_id", userId)
        .eq("active", true)
        .maybeSingle(),
    ]);
    const isAdmin = !!admin;
    const isOwnerOrAdmin =
      !!member && (member.role === "owner" || member.role === "admin");
    if (!isAdmin && !isOwnerOrAdmin) {
      return NextResponse.json({ ok: false, error: "Not authorized" }, { status: 403 });
    }

    // 6. Refuse to re-refund or refund a voided order.
    if (
      order.payment_status === "refunded" ||
      order.payment_status === "voided" ||
      order.payment_status === "partial_refund"
    ) {
      return NextResponse.json(
        { ok: false, error: `Order is already ${order.payment_status}.` },
        { status: 409 },
      );
    }
    if (order.payment_status !== "paid") {
      return NextResponse.json(
        { ok: false, error: "Only paid orders can be refunded." },
        { status: 409 },
      );
    }

    // 7. Amount: default to full total; cap at total.
    const amountCents = body.amountCents ?? order.total_cents;
    if (amountCents > order.total_cents) {
      return NextResponse.json(
        { ok: false, error: "Refund amount exceeds order total." },
        { status: 400 },
      );
    }
    const isFullRefund = amountCents === order.total_cents;

    // 8. Currency lives on merchants (not on orders).
    const { data: merchantRow } = await svc
      .from("merchants")
      .select("currency")
      .eq("id", order.merchant_id)
      .maybeSingle();
    const currency = String((merchantRow as any)?.currency ?? "").trim();
    if (!currency) {
      return NextResponse.json(
        { ok: false, error: "Merchant currency not configured." },
        { status: 400 },
      );
    }

    // 9. We need the gateway-side transaction id. It's written by
    //    /api/payments/status on success. If it's missing (older order, cash
    //    sale, manual entry), we can't refund automatically.
    const gatewayPaymentId = order.gateway_payment_id;
    if (!gatewayPaymentId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No gateway transaction id recorded for this order — cannot refund automatically. Void instead.",
        },
        { status: 400 },
      );
    }

    // 10. Resolve the gateway. Prefer the provider recorded against the
    //     original successful payment; otherwise fall back to the merchant's
    //     default enabled non-cash gateway (matches payments/start).
    let chosen: GatewayRow | null = null;
    if (order.gateway_provider) {
      const { data: gw } = await svc
        .from("merchant_payment_gateways")
        .select("provider, config, is_default")
        .eq("merchant_id", order.merchant_id)
        .eq("provider", order.gateway_provider)
        .eq("enabled", true)
        .maybeSingle();
      chosen = (gw as GatewayRow | null) ?? null;
    }
    if (!chosen) {
      const { data: gws } = await svc
        .from("merchant_payment_gateways")
        .select("provider, config, is_default")
        .eq("merchant_id", order.merchant_id)
        .eq("enabled", true);
      const list = ((gws ?? []) as GatewayRow[]).filter((g) => g.provider !== "cash");
      chosen = list.find((g) => g.is_default) ?? list[0] ?? null;
    }
    if (!chosen) {
      return NextResponse.json(
        { ok: false, error: "No card gateway configured for this merchant." },
        { status: 400 },
      );
    }

    const adapter = getTerminalProvider(chosen.provider, chosen.config ?? {});
    if (!adapter) {
      return NextResponse.json(
        { ok: false, error: `Refunds not supported for ${chosen.provider}.` },
        { status: 400 },
      );
    }

    // 11. Call the gateway.
    const refundResult = await adapter.refund(gatewayPaymentId, amountCents, currency);
    if (!refundResult.ok) {
      return NextResponse.json(
        { ok: false, error: safeErrorMessage(refundResult.error, "Gateway refused refund.") },
        { status: 502 },
      );
    }

    // 12. Flip the order's local state. Full refund mirrors void_order by
    //     also flipping status='cancelled'; partial refunds leave the
    //     fulfillment state alone.
    const updates: Record<string, unknown> = {
      payment_status: isFullRefund ? "refunded" : "partial_refund",
    };
    if (isFullRefund) updates.status = "cancelled";
    await svc.from("orders").update(updates).eq("id", order.id);

    // 13. Audit ledger entry. admin_audit is the platform-wide privileged-
    //     action log; reusing it (rather than a new refunds table) keeps the
    //     first cut small. Detail is a JSON string, matching existing rows.
    await svc.from("admin_audit").insert({
      actor: userId,
      action: "refund_order",
      merchant_id: order.merchant_id,
      detail: JSON.stringify({
        order_id: order.id,
        order_number: order.number,
        amount_cents: amountCents,
        currency,
        gateway: chosen.provider,
        gateway_payment_id: gatewayPaymentId,
        refund_id: refundResult.refund_id ?? null,
        reason,
        full: isFullRefund,
      }),
    });

    return NextResponse.json({
      ok: true,
      refund_id: refundResult.refund_id ?? null,
      provider: chosen.provider,
      amount_cents: amountCents,
      full: isFullRefund,
    });
  } catch (e) {
    // Same hardening as payments/start + payments/status: never forward raw
    // adapter or DB error text to the client.
    console.error("[refunds]", e);
    return NextResponse.json(
      { ok: false, error: safeErrorMessage(e, "Failed to issue refund.") },
      { status: 500 },
    );
  }
}
