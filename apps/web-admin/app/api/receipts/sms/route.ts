import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
// E.164-ish: optional leading +, first digit 1–9, then 6–15 more digits.
// We strip spaces / dashes / parens before testing so common input formats pass.
const PHONE_RE = /^\+?[1-9]\d{6,15}$/;
// Twilio rejects bodies over 1600 chars; we cap at ~3 SMS segments to keep costs
// predictable. The renderer trims to this same budget before sending.
const SMS_MAX = 480;

interface OrderLine {
  name_snapshot: string;
  quantity: number;
  unit_price_cents: number;
}

interface OrderRow {
  id: string;
  merchant_id: string;
  number: number;
  total_cents: number;
  created_at: string;
  order_items: OrderLine[];
}

interface MerchantRow {
  name: string;
}

// Short plain-text SMS body. Format:
//   "{merchant} — Order #{n} · {total}. Items: {qty}× {name}, … Thanks!"
// Items are greedily packed until the SMS_MAX budget is exhausted; if we
// run out of room we append "…" so the truncation is visible.
function renderReceiptSms(o: OrderRow, m: MerchantRow): string {
  const head = `${m.name} — Order #${o.number} · ${fmt(o.total_cents)}.`;
  const tail = " Thanks!";
  const prefix = " Items: ";
  const budget = SMS_MAX - head.length - prefix.length - tail.length;
  const items: string[] = [];
  let used = 0;
  for (const l of o.order_items) {
    const piece = `${l.quantity}× ${l.name_snapshot}`;
    const add = (items.length ? ", " : "") + piece;
    if (used + add.length > budget) {
      items.push("…");
      break;
    }
    items.push(piece);
    used += add.length;
  }
  const body = `${head}${prefix}${items.join(", ")}${tail}`;
  return body.length > SMS_MAX ? body.slice(0, SMS_MAX) : body;
}

export async function POST(req: NextRequest) {
  const SID = process.env.TWILIO_ACCOUNT_SID;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const FROM = process.env.TWILIO_FROM_NUMBER;

  if (!SID || !TOKEN || !FROM) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SMS sender not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in Vercel env.",
      },
      { status: 503 },
    );
  }

  let body: { orderId?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const orderId = body.orderId?.trim();
  const rawPhone = body.phone?.replace(/[\s\-()]/g, "");
  if (!orderId || !rawPhone || !PHONE_RE.test(rawPhone)) {
    return NextResponse.json(
      { ok: false, error: "orderId and a valid phone (E.164) are required." },
      { status: 400 },
    );
  }
  const toPhone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;

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
      "id, merchant_id, number, total_cents, created_at, order_items(name_snapshot, quantity, unit_price_cents)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr || !orderRaw) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }
  const order = orderRaw as OrderRow;

  // Authorize: user must be an active member of the order's merchant (or a platform admin).
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

  // Fetch the merchant header for the SMS body.
  const { data: merchantRaw } = await (svc as any)
    .from("merchants")
    .select("name")
    .eq("id", order.merchant_id)
    .maybeSingle();
  const merchant = (merchantRaw ?? { name: "Squarely" }) as MerchantRow;

  const smsBody = renderReceiptSms(order, merchant);

  // Send via Twilio's REST API directly (no SDK). Basic auth = base64("SID:TOKEN").
  const form = new URLSearchParams({ From: FROM, To: toPhone, Body: smsBody });
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    return NextResponse.json(
      { ok: false, error: `SMS send failed (${resp.status}): ${errBody.slice(0, 200)}` },
      { status: 502 },
    );
  }

  // Best-effort: stamp receipt_printed_at on the order (we treat SMS as a form
  // of receipt delivery for the dashboard). supabase-js v2 builders are
  // thenable-only — must await to actually fire the update.
  await (svc as any).from("orders").update({ receipt_printed_at: new Date().toISOString() }).eq("id", orderId);

  return NextResponse.json({ ok: true });
}
