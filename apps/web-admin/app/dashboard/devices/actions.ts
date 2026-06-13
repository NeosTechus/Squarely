"use server";

import { getServiceSupabase } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { safeErrorMessage } from "@/lib/redact";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// ---- Validation helpers --------------------------------------------------

// IPv4 dotted quad. We deliberately reject hostnames so a misconfig can't
// silently point the LAN print path at an arbitrary domain.
const IPV4 =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

const MIN_PORT = 1;
const MAX_PORT = 65535;
const MAX_LABEL_LEN = 60;
const MAX_MODEL_LEN = 60;
const MAX_CLOUD_ID_LEN = 120;
const ALLOWED_KINDS = new Set(["lan", "cloud"]);
const ALLOWED_TABLES = new Set(["devices", "terminals", "printers"]);

function svcClient() {
  return getServiceSupabase() as unknown as {
    from: (t: string) => any;
  };
}

// ---- Printer creation ----------------------------------------------------

export interface AddPrinterInput {
  merchantId: string;
  label: string;
  model: string;
  kind: "lan" | "cloud";
  ipAddress?: string | null;
  port?: number | null;
  cloudDeviceId?: string | null;
  isDefault?: boolean;
  supportsCashDrawer?: boolean;
}

export async function addPrinter(input: AddPrinterInput): Promise<ActionResult> {
  const guard = await requireRole(input.merchantId, ["owner", "admin"]);
  if (!guard.ok) return { ok: false, error: guard.error };

  const label = (input.label ?? "").trim();
  const model = (input.model ?? "").trim().slice(0, MAX_MODEL_LEN) || "Generic ESC-POS";

  if (!label) return { ok: false, error: "Label is required." };
  if (label.length > MAX_LABEL_LEN) {
    return { ok: false, error: `Label must be ${MAX_LABEL_LEN} characters or fewer.` };
  }
  if (!ALLOWED_KINDS.has(input.kind)) {
    return { ok: false, error: "Invalid printer connection type." };
  }

  const payload: Record<string, unknown> = {
    merchant_id: guard.merchantId,
    label,
    model,
    kind: input.kind,
    supports_cash_drawer: Boolean(input.supportsCashDrawer),
    is_default: Boolean(input.isDefault),
    active: true,
  };

  if (input.kind === "lan") {
    const ip = (input.ipAddress ?? "").trim();
    if (!ip) return { ok: false, error: "IP address is required for a LAN printer." };
    if (!IPV4.test(ip)) {
      return { ok: false, error: "IP address must be a valid IPv4 address." };
    }
    const portNum = Number(input.port ?? 9100);
    if (
      !Number.isFinite(portNum) ||
      !Number.isInteger(portNum) ||
      portNum < MIN_PORT ||
      portNum > MAX_PORT
    ) {
      return { ok: false, error: `Port must be an integer between ${MIN_PORT} and ${MAX_PORT}.` };
    }
    payload.ip_address = ip;
    payload.port = portNum;
  } else {
    const cloudId = (input.cloudDeviceId ?? "").trim();
    if (!cloudId) {
      return { ok: false, error: "Cloud device id is required for a cloud printer." };
    }
    if (cloudId.length > MAX_CLOUD_ID_LEN) {
      return { ok: false, error: "Cloud device id is too long." };
    }
    if (!/^[A-Za-z0-9._:-]+$/.test(cloudId)) {
      return { ok: false, error: "Cloud device id contains invalid characters." };
    }
    payload.cloud_device_id = cloudId;
  }

  const svc = svcClient();

  // Clear the previous default to satisfy the partial unique index
  // `printers_one_default_per_merchant`.
  if (payload.is_default) {
    const { error: clearErr } = await svc
      .from("printers")
      .update({ is_default: false })
      .eq("merchant_id", guard.merchantId)
      .eq("is_default", true);
    if (clearErr) {
      return { ok: false, error: safeErrorMessage(clearErr.message, "Could not update default printer.") };
    }
  }

  const { error } = await svc.from("printers").insert(payload);
  if (error) return { ok: false, error: safeErrorMessage(error.message, "Could not add printer.") };
  return { ok: true };
}

// ---- Printer default toggle ---------------------------------------------

export async function setPrinterDefault(input: {
  merchantId: string;
  printerId: string;
}): Promise<ActionResult> {
  const guard = await requireRole(input.merchantId, ["owner", "admin"]);
  if (!guard.ok) return { ok: false, error: guard.error };

  const id = (input.printerId ?? "").trim();
  if (!id) return { ok: false, error: "Printer id required." };

  const svc = svcClient();

  // Ensure the target printer belongs to this merchant — guards against a
  // crafted printerId for another tenant.
  const { data: row, error: lookupErr } = await svc
    .from("printers")
    .select("id")
    .eq("id", id)
    .eq("merchant_id", guard.merchantId)
    .maybeSingle();
  if (lookupErr) return { ok: false, error: safeErrorMessage(lookupErr.message, "Could not update default printer.") };
  if (!row) return { ok: false, error: "Printer not found." };

  const { error: clearErr } = await svc
    .from("printers")
    .update({ is_default: false })
    .eq("merchant_id", guard.merchantId)
    .eq("is_default", true);
  if (clearErr) return { ok: false, error: safeErrorMessage(clearErr.message, "Could not update default printer.") };

  const { error } = await svc
    .from("printers")
    .update({ is_default: true })
    .eq("id", id)
    .eq("merchant_id", guard.merchantId);
  if (error) return { ok: false, error: safeErrorMessage(error.message, "Could not update default printer.") };
  return { ok: true };
}

// ---- Active toggle (devices/terminals/printers) -------------------------

export async function toggleActive(input: {
  merchantId: string;
  table: "devices" | "terminals" | "printers";
  id: string;
  active: boolean;
}): Promise<ActionResult> {
  const guard = await requireRole(input.merchantId, ["owner", "admin"]);
  if (!guard.ok) return { ok: false, error: guard.error };

  if (!ALLOWED_TABLES.has(input.table)) {
    return { ok: false, error: "Invalid resource." };
  }
  const id = (input.id ?? "").trim();
  if (!id) return { ok: false, error: "id required" };
  if (typeof input.active !== "boolean") {
    return { ok: false, error: "active must be a boolean" };
  }

  const svc = svcClient();

  // Cross-tenant guard: verify the row belongs to this merchant before we
  // mutate. Without this, a forged id from a sibling tenant would also be
  // accepted by the service-role write (RLS is bypassed).
  const { data: row, error: lookupErr } = await svc
    .from(input.table)
    .select("id")
    .eq("id", id)
    .eq("merchant_id", guard.merchantId)
    .maybeSingle();
  if (lookupErr) return { ok: false, error: safeErrorMessage(lookupErr.message, "Lookup failed.") };
  if (!row) return { ok: false, error: "Not found." };

  const { error } = await svc
    .from(input.table)
    .update({ active: input.active })
    .eq("id", id)
    .eq("merchant_id", guard.merchantId);
  if (error) return { ok: false, error: safeErrorMessage(error.message, "Could not update status.") };
  return { ok: true };
}
