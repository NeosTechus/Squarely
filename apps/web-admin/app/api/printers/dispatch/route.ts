import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { buildReceiptXml } from "@squarely/printing";
import { checkRateLimit } from "@/lib/rateLimit";

// We build the ESC-POS XML and enqueue a print_jobs row. Actual dispatch
// (LAN socket write, cloud SDP push, etc.) is intentionally deferred to a
// follow-up local-agent / poll worker — Vercel functions can't reach a
// merchant's LAN printer directly. The mobile/POS UI just needs a
// "queued for printing" acknowledgement which this route provides.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OrderItemModifierRow {
  name_snapshot: string;
  price_delta_cents: number;
}

interface OrderItemRow {
  name_snapshot: string;
  unit_price_cents: number;
  quantity: number;
  notes: string | null;
  order_item_modifiers: OrderItemModifierRow[] | null;
}

interface OrderRow {
  id: string;
  merchant_id: string;
  number: number;
  order_type: string;
  source: string;
  customer_name: string | null;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  surcharge_cents: number;
  tip_cents: number;
  total_cents: number;
  payment_method: string | null;
  created_at: string;
  order_items: OrderItemRow[] | null;
}

interface MerchantRow {
  name: string;
  phone: string | null;
  city: string | null;
  region: string | null;
}

interface PrinterRow {
  id: string;
  merchant_id: string;
  kind: string;
  label: string;
  supports_cash_drawer: boolean;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  let body: { orderId?: string; printerId?: string };
  try {
    body = (await req.json()) as { orderId?: string; printerId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const orderId = body.orderId?.trim();
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId is required." }, { status: 400 });
  }
  const printerIdHint = body.printerId?.trim() || null;

  const svc = getServiceSupabase();
  const { data: userData } = await svc.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Invalid token." }, { status: 401 });
  }

  // Per-user rate limit: bounds print-queue flooding from a runaway client to
  // 60/min/user. Placed after auth (so anon traffic 401s without consuming
  // bucket entries) and before the order fetch (so a throttled caller does
  // not hit Supabase).
  const rl = checkRateLimit(`printers/dispatch:${userId}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 1) } },
    );
  }

  // Fetch the order with embedded items + modifiers.
  const { data: orderRaw, error: orderErr } = await (svc as any)
    .from("orders")
    .select(
      "id, merchant_id, number, order_type, source, customer_name, subtotal_cents, discount_cents, tax_cents, surcharge_cents, tip_cents, total_cents, payment_method, created_at, order_items(name_snapshot, unit_price_cents, quantity, notes, order_item_modifiers(name_snapshot, price_delta_cents))",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr || !orderRaw) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }
  const order = orderRaw as OrderRow;

  // Authorize: caller must be an active member of the order's merchant OR a platform admin.
  const [{ data: member }, { data: isAdmin }] = await Promise.all([
    (svc as any)
      .from("merchant_members")
      .select("user_id")
      .eq("merchant_id", order.merchant_id)
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle(),
    (svc as any)
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (!member && !isAdmin) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  // Resolve the target printer: explicit id (scoped to this merchant) OR default OR first active.
  let printer: PrinterRow | null = null;
  if (printerIdHint) {
    const { data } = await (svc as any)
      .from("printers")
      .select("id, merchant_id, kind, label, supports_cash_drawer")
      .eq("id", printerIdHint)
      .eq("merchant_id", order.merchant_id)
      .eq("active", true)
      .maybeSingle();
    printer = (data ?? null) as PrinterRow | null;
  }
  if (!printer) {
    const { data } = await (svc as any)
      .from("printers")
      .select("id, merchant_id, kind, label, supports_cash_drawer")
      .eq("merchant_id", order.merchant_id)
      .eq("active", true)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    printer = (data ?? null) as PrinterRow | null;
  }
  if (!printer) {
    return NextResponse.json(
      { ok: false, error: "No active printer configured for this merchant." },
      { status: 412 },
    );
  }

  // Fetch merchant header for the printed receipt.
  const { data: merchantRaw } = await (svc as any)
    .from("merchants")
    .select("name, phone, city, region")
    .eq("id", order.merchant_id)
    .maybeSingle();
  const merchant = (merchantRaw ?? {
    name: "Receipt",
    phone: null,
    city: null,
    region: null,
  }) as MerchantRow;

  const items = (order.order_items ?? []).map((line) => ({
    name_snapshot: line.name_snapshot,
    unit_price_cents: line.unit_price_cents,
    quantity: line.quantity,
    notes: line.notes ?? null,
    modifiers: (line.order_item_modifiers ?? []).map((m) => ({
      name_snapshot: m.name_snapshot,
      price_delta_cents: m.price_delta_cents,
    })),
  }));

  // Open the cash drawer when this is a cash sale AND the printer reports
  // a connected drawer. ESC-POS drawers pulse off the DK port on the
  // receipt printer's RJ-12 jack, so the drawer must be wired to a printer
  // we're already dispatching to.
  const openCashDrawer =
    order.payment_method === "cash" && printer.supports_cash_drawer === true;

  const xml = buildReceiptXml({
    header: {
      storeName: merchant.name ?? "Receipt",
      storeAddress: [merchant.city, merchant.region].filter(Boolean).join(", ") || null,
      storePhone: merchant.phone ?? null,
    },
    // buildReceiptXml expects the @squarely/types Order shape; only the fields
    // actually read by xml.ts are required at runtime so we cast loosely.
    order: {
      number: order.number,
      order_type: order.order_type,
      source: order.source,
      customer_name: order.customer_name,
      subtotal_cents: order.subtotal_cents,
      discount_cents: order.discount_cents,
      tax_cents: order.tax_cents,
      surcharge_cents: order.surcharge_cents,
      tip_cents: order.tip_cents,
      total_cents: order.total_cents,
      created_at: order.created_at,
      items,
    } as any,
    openCashDrawer,
  });

  const { data: jobRow, error: insErr } = await (svc as any)
    .from("print_jobs")
    .insert({
      merchant_id: order.merchant_id,
      order_id: order.id,
      printer_id: printer.id,
      status: "queued",
      payload: xml,
      kick_drawer: openCashDrawer,
    })
    .select("id")
    .single();
  if (insErr) {
    // PostgREST error messages can include constraint/table/value text. Keep
    // the public message generic; log detail server-side for ops.
    console.error("[printers/dispatch] insert failed", insErr.message);
    return NextResponse.json(
      { ok: false, error: "Failed to enqueue print job." },
      { status: 500 },
    );
  }

  // Best-effort: stamp receipt_printed_at on the order (we treat enqueueing as
  // a delivery attempt, same way the email route stamps on send).
  await (svc as any)
    .from("orders")
    .update({ receipt_printed_at: new Date().toISOString() })
    .eq("id", orderId);

  return NextResponse.json({
    ok: true,
    jobId: (jobRow as { id: string }).id,
    via: printer.kind,
    printerId: printer.id,
  });
}
