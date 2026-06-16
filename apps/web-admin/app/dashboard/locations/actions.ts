"use server";

import { getServiceSupabase } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { safeErrorMessage } from "@/lib/redact";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const MAX_NAME_LEN = 80;
const MAX_LINE_LEN = 200;
const MAX_CITY_LEN = 80;
const MAX_REGION_LEN = 80;
const MAX_POSTAL_LEN = 20;
const MAX_TZ_LEN = 60;

function svcClient() {
  return getServiceSupabase() as unknown as {
    from: (t: string) => any;
  };
}

function trimToMax(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

export interface UpsertLocationInput {
  merchantId: string;
  id?: string | null;
  name: string;
  address_line1?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  timezone?: string | null;
  active?: boolean;
}

/**
 * Create or update a location. Owner/admin only.
 */
export async function upsertLocation(
  input: UpsertLocationInput,
): Promise<ActionResult<{ id: string }>> {
  const guard = await requireRole(input.merchantId, ["owner", "admin"]);
  if (!guard.ok) return { ok: false, error: guard.error };

  const name = trimToMax(input.name, MAX_NAME_LEN);
  if (!name) return { ok: false, error: "Name is required." };

  const payload: Record<string, unknown> = {
    merchant_id: guard.merchantId,
    name,
    address_line1: trimToMax(input.address_line1, MAX_LINE_LEN) || null,
    city: trimToMax(input.city, MAX_CITY_LEN) || null,
    region: trimToMax(input.region, MAX_REGION_LEN) || null,
    postal_code: trimToMax(input.postal_code, MAX_POSTAL_LEN) || null,
    timezone: trimToMax(input.timezone, MAX_TZ_LEN) || "America/New_York",
    active: input.active ?? true,
  };

  const svc = svcClient();
  const id = (input.id ?? "").trim();

  if (id) {
    // Cross-tenant guard: confirm the row belongs to this merchant.
    const { data: row, error: lookupErr } = await svc
      .from("locations")
      .select("id")
      .eq("id", id)
      .eq("merchant_id", guard.merchantId)
      .maybeSingle();
    if (lookupErr) {
      return { ok: false, error: safeErrorMessage(lookupErr.message, "Lookup failed.") };
    }
    if (!row) return { ok: false, error: "Location not found." };

    const { error } = await svc
      .from("locations")
      .update(payload)
      .eq("id", id)
      .eq("merchant_id", guard.merchantId);
    if (error) {
      return { ok: false, error: safeErrorMessage(error.message, "Could not update location.") };
    }
    return { ok: true, data: { id } };
  }

  const { data, error } = await svc
    .from("locations")
    .insert(payload)
    .select("id")
    .single();
  if (error) {
    return { ok: false, error: safeErrorMessage(error.message, "Could not create location.") };
  }
  return { ok: true, data: { id: (data as { id: string }).id } };
}

/**
 * Owner/admin: set the merchant's default location (used by mobile boot
 * and by the dashboard when a single-location view is requested). Pass
 * `null` to clear.
 */
export async function setDefaultLocation(input: {
  merchantId: string;
  locationId: string | null;
}): Promise<ActionResult> {
  const guard = await requireRole(input.merchantId, ["owner", "admin"]);
  if (!guard.ok) return { ok: false, error: guard.error };

  const svc = svcClient();
  const locId = (input.locationId ?? "").trim() || null;

  if (locId) {
    const { data: row } = await svc
      .from("locations")
      .select("id")
      .eq("id", locId)
      .eq("merchant_id", guard.merchantId)
      .maybeSingle();
    if (!row) return { ok: false, error: "Location not found." };
  }

  const { error } = await svc
    .from("merchants")
    .update({ default_location_id: locId })
    .eq("id", guard.merchantId);
  if (error) {
    return { ok: false, error: safeErrorMessage(error.message, "Could not set default.") };
  }
  return { ok: true };
}

/**
 * Toggle a location's active flag. Owner/admin only. Deactivation does NOT
 * cascade-delete orders or devices — historical orders keep their location_id
 * (FK is on-delete-set-null on locations) so reports remain accurate.
 */
export async function setLocationActive(input: {
  merchantId: string;
  id: string;
  active: boolean;
}): Promise<ActionResult> {
  const guard = await requireRole(input.merchantId, ["owner", "admin"]);
  if (!guard.ok) return { ok: false, error: guard.error };

  const id = (input.id ?? "").trim();
  if (!id) return { ok: false, error: "Location id required." };
  if (typeof input.active !== "boolean") {
    return { ok: false, error: "active must be a boolean" };
  }

  const svc = svcClient();
  const { data: row, error: lookupErr } = await svc
    .from("locations")
    .select("id")
    .eq("id", id)
    .eq("merchant_id", guard.merchantId)
    .maybeSingle();
  if (lookupErr) {
    return { ok: false, error: safeErrorMessage(lookupErr.message, "Lookup failed.") };
  }
  if (!row) return { ok: false, error: "Location not found." };

  const { error } = await svc
    .from("locations")
    .update({ active: input.active })
    .eq("id", id)
    .eq("merchant_id", guard.merchantId);
  if (error) {
    return { ok: false, error: safeErrorMessage(error.message, "Could not update.") };
  }
  return { ok: true };
}
