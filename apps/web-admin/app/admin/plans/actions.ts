"use server";

import { getServiceSupabase, getServerSupabase } from "@/lib/supabase";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type UpdatePlanInput = {
  id: string;
  display_name: string;
  monthly_price_cents: number;
  yearly_price_cents: number;
  device_limit: number | null;
  features: string[];
};

/**
 * Verify the caller is an authenticated platform admin. Returns the
 * service-role client on success, or an error.
 */
async function requirePlatformAdmin(): Promise<
  | { ok: true; svc: ReturnType<typeof getServiceSupabase> }
  | { ok: false; error: string }
> {
  const server = await getServerSupabase();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const svc = getServiceSupabase();
  const { data: admin } = await (svc as any)
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!admin) return { ok: false, error: "Not authorized." };

  return { ok: true, svc };
}

/**
 * Update an existing plan's editable details (display name, pricing, device
 * limit, features). Tier cannot be changed and plans cannot be deleted.
 */
export async function updatePlan(input: UpdatePlanInput): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Plan id is required." };

  const display_name = input.display_name.trim();
  if (!display_name) return { ok: false, error: "Display name is required." };

  const monthly = Math.round(input.monthly_price_cents);
  const yearly = Math.round(input.yearly_price_cents);
  if (!Number.isFinite(monthly) || monthly < 0)
    return { ok: false, error: "Monthly price must be a non-negative number." };
  if (!Number.isFinite(yearly) || yearly < 0)
    return { ok: false, error: "Yearly price must be a non-negative number." };

  let device_limit: number | null = null;
  if (input.device_limit != null) {
    const d = Math.round(input.device_limit);
    if (!Number.isFinite(d) || d < 0)
      return { ok: false, error: "Device limit must be a non-negative number or empty." };
    device_limit = d;
  }

  const features = (input.features ?? [])
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { svc } = auth;

  const { error } = await (svc as any)
    .from("plans")
    .update({
      display_name,
      monthly_price_cents: monthly,
      yearly_price_cents: yearly,
      device_limit,
      features,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
