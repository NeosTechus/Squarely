"use server";

import { getServiceSupabase } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { safeErrorMessage } from "@/lib/redact";
import { COUNTRIES } from "@/lib/countries";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// ---- Validation helpers --------------------------------------------------

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const UPI_VPA = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;
const ALLOWED_COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));
const STATE_REGEX = /^[A-Z]{2}$/;
const HTTPS_URL = /^https:\/\/[^\s<>"']+$/;

const MAX_TAX_BPS = 30 * 100; // 30%
const MAX_HEADLINE_LEN = 80;
const MAX_SUBTEXT_LEN = 160;
const MAX_CITY_LEN = 80;
const MAX_PAYEE_LEN = 120;

function svcClient() {
  return getServiceSupabase() as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  };
}

// ---- Theme ---------------------------------------------------------------

export async function saveBrandColor(input: {
  merchantId: string;
  color: string;
}): Promise<ActionResult> {
  const guard = await requireRole(input.merchantId, ["owner", "admin"]);
  if (!guard.ok) return { ok: false, error: guard.error };

  const color = (input.color ?? "").trim();
  if (!HEX_COLOR.test(color)) {
    return { ok: false, error: "Color must be a 6-digit hex like #4f46e5." };
  }

  const svc = svcClient();
  const { error } = await svc.from("merchants").update({ brand_color: color }).eq("id", guard.merchantId);
  if (error) return { ok: false, error: safeErrorMessage(error.message, "Could not save color.") };
  return { ok: true };
}

// ---- Kiosk landing -------------------------------------------------------

export async function saveKioskText(input: {
  merchantId: string;
  headline: string;
  subtext: string;
}): Promise<ActionResult> {
  const guard = await requireRole(input.merchantId, ["owner", "admin"]);
  if (!guard.ok) return { ok: false, error: guard.error };

  const headline = (input.headline ?? "").trim().slice(0, MAX_HEADLINE_LEN);
  const subtext = (input.subtext ?? "").trim().slice(0, MAX_SUBTEXT_LEN);

  const svc = svcClient();
  const { error } = await svc
    .from("merchants")
    .update({ kiosk_headline: headline || null, kiosk_subtext: subtext || null })
    .eq("id", guard.merchantId);
  if (error) return { ok: false, error: safeErrorMessage(error.message, "Could not save kiosk text.") };
  return { ok: true };
}

export async function saveKioskImageUrl(input: {
  merchantId: string;
  url: string | null;
}): Promise<ActionResult> {
  const guard = await requireRole(input.merchantId, ["owner", "admin"]);
  if (!guard.ok) return { ok: false, error: guard.error };

  let url: string | null = null;
  if (input.url !== null && input.url !== undefined && input.url !== "") {
    const v = String(input.url).trim();
    if (!HTTPS_URL.test(v) || v.length > 2048) {
      return { ok: false, error: "Image URL must be a valid https:// link." };
    }
    url = v;
  }

  const svc = svcClient();
  const { error } = await svc.from("merchants").update({ kiosk_image_url: url }).eq("id", guard.merchantId);
  if (error) return { ok: false, error: safeErrorMessage(error.message, "Could not update image.") };
  return { ok: true };
}

// ---- Sales tax -----------------------------------------------------------

export async function saveTaxBps(input: {
  merchantId: string;
  bps: number;
}): Promise<ActionResult> {
  const guard = await requireRole(input.merchantId, ["owner", "admin"]);
  if (!guard.ok) return { ok: false, error: guard.error };

  const bps = Number(input.bps);
  if (!Number.isFinite(bps) || !Number.isInteger(bps) || bps < 0 || bps > MAX_TAX_BPS) {
    return { ok: false, error: `Tax must be an integer between 0 and ${MAX_TAX_BPS} basis points.` };
  }

  const svc = svcClient();
  const { error } = await svc.from("merchants").update({ tax_rate_bps: bps }).eq("id", guard.merchantId);
  if (error) return { ok: false, error: safeErrorMessage(error.message, "Could not save tax rate.") };
  return { ok: true };
}

export async function saveLocation(input: {
  merchantId: string;
  region: string;
  city: string;
  country: string;
}): Promise<ActionResult> {
  const guard = await requireRole(input.merchantId, ["owner", "admin"]);
  if (!guard.ok) return { ok: false, error: guard.error };

  const region = (input.region ?? "").trim().toUpperCase();
  const city = (input.city ?? "").trim();
  const country = (input.country ?? "").trim().toUpperCase();

  if (region && !STATE_REGEX.test(region)) {
    return { ok: false, error: "State must be a 2-letter code." };
  }
  if (city.length > MAX_CITY_LEN) {
    return { ok: false, error: "City name is too long." };
  }
  if (country && !ALLOWED_COUNTRY_CODES.has(country as (typeof COUNTRIES)[number]["code"])) {
    return { ok: false, error: "Unsupported country." };
  }

  const svc = svcClient();
  const { error } = await svc
    .from("merchants")
    .update({
      region: region || null,
      city: city || null,
      country: country || null,
    })
    .eq("id", guard.merchantId);
  if (error) return { ok: false, error: safeErrorMessage(error.message, "Could not save location.") };
  return { ok: true };
}

// ---- Device passcode -----------------------------------------------------

export async function saveDevicePasscode(input: {
  merchantId: string;
  code: string;
}): Promise<ActionResult> {
  const guard = await requireRole(input.merchantId, ["owner", "admin"]);
  if (!guard.ok) return { ok: false, error: guard.error };

  const code = (input.code ?? "").replace(/[^0-9]/g, "");
  if (code.length > 0 && (code.length < 4 || code.length > 8)) {
    return { ok: false, error: "Passcode must be 4 to 8 digits." };
  }

  // Delegate to existing RPC (already does column-level write + audit).
  const svc = svcClient();
  const { data, error } = await svc.rpc("set_device_passcode", {
    p_merchant_id: guard.merchantId,
    p_code: code,
  });
  if (error) return { ok: false, error: safeErrorMessage(error.message, "Could not save passcode.") };
  if (data && data !== "ok") {
    return { ok: false, error: safeErrorMessage(String(data), "Could not save passcode.") };
  }
  return { ok: true };
}

// ---- UPI gateway ---------------------------------------------------------

export async function saveUpiGateway(input: {
  merchantId: string;
  upiVpa: string;
  payeeName: string;
  qrImageUrl: string | null;
}): Promise<ActionResult> {
  const guard = await requireRole(input.merchantId, ["owner", "admin"]);
  if (!guard.ok) return { ok: false, error: guard.error };

  const upiVpa = (input.upiVpa ?? "").trim();
  const payeeName = (input.payeeName ?? "").trim().slice(0, MAX_PAYEE_LEN);

  if (!upiVpa) {
    return { ok: false, error: "UPI VPA is required." };
  }
  if (!UPI_VPA.test(upiVpa)) {
    return { ok: false, error: "Enter a valid UPI ID (e.g. name@bank)." };
  }

  let qrImageUrl: string | null = null;
  if (input.qrImageUrl) {
    const v = String(input.qrImageUrl).trim();
    if (!HTTPS_URL.test(v) || v.length > 2048) {
      return { ok: false, error: "QR image URL must be a valid https:// link." };
    }
    qrImageUrl = v;
  }

  const svc = svcClient();
  const { error } = await svc.from("merchant_payment_gateways").upsert(
    {
      merchant_id: guard.merchantId,
      provider: "upi",
      enabled: true,
      public_config: { upiVpa, payeeName, qrImageUrl },
    },
    { onConflict: "merchant_id,provider" },
  );
  if (error) return { ok: false, error: safeErrorMessage(error.message, "Could not save UPI settings.") };
  return { ok: true };
}

export async function removeUpiGateway(input: {
  merchantId: string;
}): Promise<ActionResult> {
  const guard = await requireRole(input.merchantId, ["owner", "admin"]);
  if (!guard.ok) return { ok: false, error: guard.error };

  const svc = svcClient();
  const { error } = await svc
    .from("merchant_payment_gateways")
    .delete()
    .eq("merchant_id", guard.merchantId)
    .eq("provider", "upi");
  if (error) return { ok: false, error: safeErrorMessage(error.message, "Could not remove UPI gateway.") };
  return { ok: true };
}
