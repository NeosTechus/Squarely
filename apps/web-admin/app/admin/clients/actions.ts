"use server";

import { getServiceSupabase, getServerSupabase } from "@/lib/supabase";
import { COUNTRIES } from "@/lib/countries";

export type OnboardResult =
  | { ok: true; merchantId: string }
  | { ok: false; error: string };

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Verify the caller is an authenticated platform admin. Returns the
 * service-role client on success, or an error result.
 */
async function requirePlatformAdmin(): Promise<
  | { ok: true; svc: ReturnType<typeof getServiceSupabase>; actorId: string }
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

  return { ok: true, svc, actorId: user.id };
}

/**
 * Best-effort audit logging. Wrapped so a logging failure never breaks the
 * action that triggered it.
 */
async function recordAudit(
  svc: ReturnType<typeof getServiceSupabase>,
  row: { actor: string; action: string; merchant_id: string; detail?: string },
): Promise<void> {
  try {
    await (svc as any).from("admin_audit").insert({
      actor: row.actor,
      action: row.action,
      merchant_id: row.merchant_id,
      detail: row.detail ?? null,
    });
  } catch {
    // Swallow: auditing must never break the underlying action.
  }
}

/** Platform-admin action: suspend or reactivate a merchant. */
export async function setSuspended(
  merchantId: string,
  suspended: boolean,
): Promise<ActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { svc, actorId } = auth;

  const { error } = await (svc as any)
    .from("merchants")
    .update({ suspended })
    .eq("id", merchantId);
  if (error) return { ok: false, error: error.message };

  await recordAudit(svc, {
    actor: actorId,
    action: suspended ? "suspend" : "reactivate",
    merchant_id: merchantId,
  });
  return { ok: true };
}

/** Platform-admin action: edit a client's business name, contact email, phone. */
export async function updateClientDetails(
  merchantId: string,
  input: { name: string; email: string; phone: string },
): Promise<ActionResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  if (!name) return { ok: false, error: "Business name is required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid contact email." };
  }

  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { svc, actorId } = auth;

  const { error } = await (svc as any)
    .from("merchants")
    .update({ name, email, phone: phone || null })
    .eq("id", merchantId);
  if (error) return { ok: false, error: error.message };

  await recordAudit(svc, {
    actor: actorId,
    action: "update_details",
    merchant_id: merchantId,
  });
  return { ok: true };
}

/** Platform-admin action: set a client's country (ISO alpha-2). */
export async function setClientCountry(
  merchantId: string,
  country: string,
): Promise<ActionResult> {
  const code = country.trim().toUpperCase();
  if (!COUNTRIES.some((c) => c.code === code)) {
    return { ok: false, error: "Unsupported country." };
  }

  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { svc, actorId } = auth;

  const { error } = await (svc as any)
    .from("merchants")
    .update({ country: code })
    .eq("id", merchantId);
  if (error) return { ok: false, error: error.message };

  await recordAudit(svc, {
    actor: actorId,
    action: "change_country",
    merchant_id: merchantId,
    detail: code,
  });
  return { ok: true };
}

/** Platform-admin action: change a merchant's plan. */
export async function changePlan(
  merchantId: string,
  planTier: string,
): Promise<ActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { svc, actorId } = auth;

  const { data: plan } = await (svc as any)
    .from("plans")
    .select("id")
    .eq("tier", planTier)
    .maybeSingle();
  if (!plan?.id) return { ok: false, error: "Plan not found." };

  const periodEnd = new Date(Date.now() + 30 * 864e5).toISOString();

  const { data: existing } = await (svc as any)
    .from("subscriptions")
    .select("id")
    .eq("merchant_id", merchantId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await (svc as any)
      .from("subscriptions")
      .update({ plan_id: plan.id, status: "active", current_period_end: periodEnd })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await (svc as any).from("subscriptions").insert({
      merchant_id: merchantId,
      plan_id: plan.id,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd,
    });
    if (error) return { ok: false, error: error.message };
  }

  await recordAudit(svc, {
    actor: actorId,
    action: "change_plan",
    merchant_id: merchantId,
    detail: planTier,
  });
  return { ok: true };
}

/** Platform-admin action: reset the owner's password for a merchant. */
export async function resetOwnerPassword(
  merchantId: string,
  newPassword: string,
): Promise<ActionResult> {
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { svc, actorId } = auth;

  const { data: owner } = await (svc as any)
    .from("merchant_members")
    .select("user_id")
    .eq("merchant_id", merchantId)
    .eq("role", "owner")
    .maybeSingle();
  if (!owner?.user_id) return { ok: false, error: "Owner not found." };

  const { error } = await svc.auth.admin.updateUserById(owner.user_id, {
    password: newPassword,
  });
  if (error) return { ok: false, error: error.message };

  await recordAudit(svc, {
    actor: actorId,
    action: "reset_password",
    merchant_id: merchantId,
  });
  return { ok: true };
}

/**
 * Platform-admin action: onboard a brand-new client (merchant + owner account
 * + subscription on the chosen plan). Only callable by a platform admin.
 */
export async function onboardMerchant(input: {
  businessName: string;
  email: string;
  password: string;
  planTier: string;
  country?: string;
}): Promise<OnboardResult> {
  const businessName = input.businessName.trim();
  const email = input.email.trim().toLowerCase();
  const { password, planTier } = input;

  if (!businessName || !email || !password) {
    return { ok: false, error: "All fields are required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const server = await getServerSupabase();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const svc = getServiceSupabase();

  // Only platform admins may onboard clients.
  const { data: admin } = await (svc as any)
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!admin) return { ok: false, error: "Not authorized." };

  // 1. Auth user
  const { data: created, error: userErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr || !created.user) {
    return { ok: false, error: userErr?.message ?? "Could not create account." };
  }
  const userId = created.user.id;

  // 2. Merchant
  const slug = `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "store"}-${userId.slice(0, 6)}`;
  const { data: merchant, error: mErr } = await (svc as any)
    .from("merchants")
    .insert({ name: businessName, slug, email, country: input.country ?? "US" })
    .select("id")
    .single();
  if (mErr || !merchant) {
    await svc.auth.admin.deleteUser(userId);
    return { ok: false, error: mErr?.message ?? "Could not create store." };
  }

  // Record Terms/Privacy acceptance (admin attests via the New-client form).
  // Best-effort so it can't break onboarding if the column isn't migrated yet.
  try {
    const { error: tErr } = await (svc as any)
      .from("merchants")
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq("id", merchant.id);
    if (tErr) console.warn("terms_accepted_at not recorded:", tErr.message);
  } catch {
    // ignore
  }

  // 3. Owner membership
  const { error: memErr } = await (svc as any).from("merchant_members").insert({
    merchant_id: merchant.id,
    user_id: userId,
    role: "owner",
    display_name: "Owner",
    active: true,
  });
  if (memErr) {
    await svc.auth.admin.deleteUser(userId);
    return { ok: false, error: memErr.message };
  }

  // 4. Subscription on the chosen plan
  const { data: plan } = await (svc as any)
    .from("plans")
    .select("id")
    .eq("tier", planTier)
    .maybeSingle();
  if (plan?.id) {
    await (svc as any).from("subscriptions").insert({
      merchant_id: merchant.id,
      plan_id: plan.id,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 864e5).toISOString(),
    });
  }

  // 5. Active-merchant claim
  await svc.auth.admin.updateUserById(userId, {
    app_metadata: { active_merchant_id: merchant.id },
  });

  await recordAudit(svc, {
    actor: user.id,
    action: "onboard",
    merchant_id: merchant.id,
    detail: planTier,
  });

  return { ok: true, merchantId: merchant.id };
}

/** Platform-admin action: record an impersonation ("view as") event. */
export async function logImpersonation(merchantId: string): Promise<ActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { svc, actorId } = auth;

  await recordAudit(svc, {
    actor: actorId,
    action: "view_as",
    merchant_id: merchantId,
  });
  return { ok: true };
}
