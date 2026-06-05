import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

interface OrderLine {
  name_snapshot: string;
  quantity: number;
  unit_price_cents: number;
}

interface OrderRow {
  id: string;
  merchant_id: string;
  number: number;
  status: string;
  subtotal_cents: number;
  tax_cents: number;
  tip_cents: number;
  total_cents: number;
  payment_method: string | null;
  payment_status: string;
  created_at: string;
  order_items: OrderLine[];
}

interface MerchantRow {
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  region: string | null;
  brand_color: string | null;
}

function renderReceiptHtml(o: OrderRow, m: MerchantRow): string {
  const lines = o.order_items
    .map(
      (l) => `<tr>
        <td style="padding:6px 0;color:#0f172a">${l.quantity} × ${escapeHtml(l.name_snapshot)}</td>
        <td style="padding:6px 0;text-align:right;color:#0f172a">${fmt(l.unit_price_cents * l.quantity)}</td>
      </tr>`,
    )
    .join("");
  const brand = m.brand_color || "#4f46e5";
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;padding:24px;margin:0">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="padding:24px 24px 18px;border-bottom:1px solid #e2e8f0">
      <div style="font-size:20px;font-weight:700;color:#0f172a">${escapeHtml(m.name)}</div>
      ${m.city || m.region ? `<div style="font-size:13px;color:#64748b;margin-top:2px">${escapeHtml([m.city, m.region].filter(Boolean).join(", "))}</div>` : ""}
      ${m.phone ? `<div style="font-size:13px;color:#64748b">${escapeHtml(m.phone)}</div>` : ""}
    </div>
    <div style="padding:20px 24px 8px;color:#475569;font-size:14px">
      <div>Order <strong style="color:#0f172a">#${o.number}</strong></div>
      <div style="margin-top:2px">${new Date(o.created_at).toLocaleString()}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;padding:0 24px" cellpadding="0" cellspacing="0">
      <tbody style="border-top:1px dashed #e2e8f0;border-bottom:1px dashed #e2e8f0">
        ${lines}
      </tbody>
    </table>
    <div style="padding:14px 24px 24px;font-size:14px">
      <table style="width:100%;border-collapse:collapse" cellpadding="0" cellspacing="0">
        <tr><td style="color:#64748b">Subtotal</td><td style="text-align:right;color:#0f172a">${fmt(o.subtotal_cents)}</td></tr>
        ${o.tax_cents > 0 ? `<tr><td style="color:#64748b">Tax</td><td style="text-align:right;color:#0f172a">${fmt(o.tax_cents)}</td></tr>` : ""}
        ${o.tip_cents > 0 ? `<tr><td style="color:#64748b">Tip</td><td style="text-align:right;color:#0f172a">${fmt(o.tip_cents)}</td></tr>` : ""}
        <tr><td style="padding-top:8px;border-top:1px solid #e2e8f0;font-weight:700;color:#0f172a">Total</td>
            <td style="padding-top:8px;border-top:1px solid #e2e8f0;text-align:right;font-weight:700;color:${brand}">${fmt(o.total_cents)}</td></tr>
      </table>
      ${o.payment_method ? `<div style="margin-top:10px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;text-align:center">Paid · ${escapeHtml(o.payment_method)}</div>` : ""}
    </div>
    <div style="background:#f8fafc;padding:14px 24px;text-align:center;font-size:12px;color:#94a3b8">Thank you!</div>
  </div>
</body></html>`;
}

function renderReceiptText(o: OrderRow, m: MerchantRow): string {
  const lines = o.order_items.map((l) => `${l.quantity} × ${l.name_snapshot}  ${fmt(l.unit_price_cents * l.quantity)}`).join("\n");
  return `${m.name}
Order #${o.number} · ${new Date(o.created_at).toLocaleString()}

${lines}

Subtotal  ${fmt(o.subtotal_cents)}
${o.tax_cents > 0 ? `Tax       ${fmt(o.tax_cents)}\n` : ""}${o.tip_cents > 0 ? `Tip       ${fmt(o.tip_cents)}\n` : ""}Total     ${fmt(o.total_cents)}
${o.payment_method ? `Paid · ${o.payment_method}` : ""}

Thank you!`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export async function POST(req: NextRequest) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM = process.env.EMAIL_FROM || "Squarely <receipts@squarely.com>";

  if (!RESEND_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "Email sender not configured. Set RESEND_API_KEY in Vercel env." },
      { status: 503 },
    );
  }

  let body: { orderId?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const orderId = body.orderId?.trim();
  const toEmail = body.email?.trim().toLowerCase();
  if (!orderId || !toEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
    return NextResponse.json({ ok: false, error: "orderId and a valid email are required." }, { status: 400 });
  }

  // Authenticate the caller against their bearer token (mobile sends session JWT;
  // web routes can also call us, in which case Authorization is forwarded).
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });

  const svc = getServiceSupabase();
  const { data: userData } = await svc.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "Invalid token." }, { status: 401 });

  // Fetch order with embedded lines.
  const { data: orderRaw, error: orderErr } = await (svc as any)
    .from("orders")
    .select(
      "id, merchant_id, number, status, subtotal_cents, tax_cents, tip_cents, total_cents, payment_method, payment_status, created_at, order_items(name_snapshot, quantity, unit_price_cents)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr || !orderRaw) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }
  const order = orderRaw as OrderRow;

  // Authorize: user must be a member of the order's merchant (or a platform admin).
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
    return NextResponse.json({ ok: false, error: "Not a member of that merchant." }, { status: 403 });
  }

  // Fetch the merchant header for the email.
  const { data: merchantRaw } = await (svc as any)
    .from("merchants")
    .select("name, email, phone, city, region, brand_color")
    .eq("id", order.merchant_id)
    .maybeSingle();
  const merchant = (merchantRaw ?? { name: "Squarely", email: "", phone: null, city: null, region: null, brand_color: null }) as MerchantRow;

  // Send via Resend's REST API (no SDK needed).
  const subject = `Receipt · Order #${order.number} · ${merchant.name}`;
  const html = renderReceiptHtml(order, merchant);
  const text = renderReceiptText(order, merchant);

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM, to: [toEmail], subject, html, text }),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    return NextResponse.json(
      { ok: false, error: `Email send failed (${resp.status}): ${errBody.slice(0, 200)}` },
      { status: 502 },
    );
  }

  // Best-effort: stamp receipt_printed_at on the order (we treat email as a
  // form of receipt delivery for the dashboard).
  void (svc as any).from("orders").update({ receipt_printed_at: new Date().toISOString() }).eq("id", orderId);

  return NextResponse.json({ ok: true });
}
