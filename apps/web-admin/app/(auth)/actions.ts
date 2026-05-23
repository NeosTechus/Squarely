"use server";

import { getServiceSupabase, getServerSupabase } from "@/lib/supabase";

export type SignUpResult = { ok: true } | { ok: false; error: string };

/**
 * Create a brand-new merchant + owner account.
 * Runs server-side with the service-role key because the `merchants` table
 * has no INSERT policy (merchant creation is a privileged onboarding action).
 */
export async function signUpMerchant(formData: {
  email: string;
  password: string;
  businessName: string;
}): Promise<SignUpResult> {
  const email = formData.email.trim().toLowerCase();
  const password = formData.password;
  const businessName = formData.businessName.trim();

  if (!email || !password || !businessName) {
    return { ok: false, error: "All fields are required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const svc = getServiceSupabase();

  // 1. Create the auth user (email pre-confirmed so they can log in immediately).
  const { data: created, error: userErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr || !created.user) {
    return { ok: false, error: userErr?.message ?? "Could not create account." };
  }
  const userId = created.user.id;

  // 2. Create the merchant.
  const slug =
    businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "merchant";
  const uniqueSlug = `${slug}-${userId.slice(0, 6)}`;

  const { data: merchant, error: merchantErr } = await (svc as any)
    .from("merchants")
    .insert({ name: businessName, slug: uniqueSlug, email })
    .select("id")
    .single();

  if (merchantErr || !merchant) {
    // Roll back the orphaned auth user so the email can be reused.
    await svc.auth.admin.deleteUser(userId);
    return { ok: false, error: merchantErr?.message ?? "Could not create store." };
  }

  // 3. Owner membership.
  const { error: memberErr } = await (svc as any).from("merchant_members").insert({
    merchant_id: merchant.id,
    user_id: userId,
    role: "owner",
    display_name: "Owner",
    active: true,
  });
  if (memberErr) {
    await svc.auth.admin.deleteUser(userId);
    return { ok: false, error: memberErr.message };
  }

  // 4. Set the active merchant on the JWT app_metadata.
  await svc.auth.admin.updateUserById(userId, {
    app_metadata: { active_merchant_id: merchant.id },
  });

  return { ok: true };
}

/**
 * Ensure the currently signed-in user has a merchant. Used after OAuth
 * (Google) sign-in: a brand-new Google user has no merchant yet, so we
 * auto-create one and make them its owner. Idempotent + safe to call on
 * every login. Platform admins are skipped.
 */
export async function ensureMerchantForCurrentUser(): Promise<void> {
  const server = await getServerSupabase();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user) return;

  const svc = getServiceSupabase();

  // Platform admins don't own a merchant.
  const { data: isAdmin } = await (svc as any)
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (isAdmin) return;

  // Already a member of something? nothing to do.
  const { data: existing } = await (svc as any)
    .from("merchant_members")
    .select("merchant_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (existing?.merchant_id) {
    // Make sure the active-merchant claim is set.
    if (!(user.app_metadata as Record<string, unknown>)?.active_merchant_id) {
      await svc.auth.admin.updateUserById(user.id, {
        app_metadata: { active_merchant_id: existing.merchant_id },
      });
    }
    return;
  }

  const email = (user.email ?? "owner").toLowerCase();
  const base = (user.user_metadata?.full_name as string) || email.split("@")[0] || "My Store";
  const slug = `${base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "store"}-${user.id.slice(0, 6)}`;

  const { data: merchant } = await (svc as any)
    .from("merchants")
    .insert({ name: base, slug, email })
    .select("id")
    .single();
  if (!merchant) return;

  await (svc as any).from("merchant_members").insert({
    merchant_id: merchant.id,
    user_id: user.id,
    role: "owner",
    display_name: base,
    active: true,
  });

  await svc.auth.admin.updateUserById(user.id, {
    app_metadata: { active_merchant_id: merchant.id },
  });
}
