"use server";

import { getServerSupabase, getServiceSupabase } from "@/lib/supabase";

export type MerchantRole =
  | "owner"
  | "admin"
  | "manager"
  | "cashier"
  | "kitchen"
  | "viewer";

export const MERCHANT_ROLES: MerchantRole[] = [
  "owner",
  "admin",
  "manager",
  "cashier",
  "kitchen",
  "viewer",
];

export type AddTeamMemberResult = { ok: true } | { ok: false; error: string };

/**
 * Create a new staff member: an auth user + a merchant_members row.
 * Runs server-side with the service-role key because creating auth users and
 * inserting members across users is a privileged action.
 *
 * Security: the caller must be an active owner/admin of `merchantId`.
 */
export async function addTeamMember(formData: {
  email: string;
  password: string;
  displayName: string;
  role: MerchantRole;
  merchantId: string;
}): Promise<AddTeamMemberResult> {
  const email = formData.email.trim().toLowerCase();
  const password = formData.password;
  const displayName = formData.displayName.trim();
  const role = formData.role;
  const merchantId = formData.merchantId;

  // 1. Validate input.
  if (!email || !password || !displayName || !merchantId) {
    return { ok: false, error: "All fields are required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (!MERCHANT_ROLES.includes(role)) {
    return { ok: false, error: "Invalid role." };
  }

  // Verify the caller before doing anything privileged.
  const server = await getServerSupabase();
  const {
    data: { user: caller },
  } = await server.auth.getUser();
  if (!caller) {
    return { ok: false, error: "Not authenticated." };
  }

  const svc = getServiceSupabase() as unknown as {
    from: (t: string) => any;
    auth: { admin: any };
  };

  const { data: callerMembership, error: callerErr } = await svc
    .from("merchant_members")
    .select("role")
    .eq("merchant_id", merchantId)
    .eq("user_id", caller.id)
    .eq("active", true)
    .maybeSingle();

  if (callerErr) {
    return { ok: false, error: callerErr.message };
  }
  const callerRole = (callerMembership as { role?: string } | null)?.role;
  if (callerRole !== "owner" && callerRole !== "admin") {
    return { ok: false, error: "You are not allowed to add members to this store." };
  }

  // 2. Create the auth user (email pre-confirmed so they can log in immediately).
  const { data: created, error: userErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr || !created?.user) {
    return { ok: false, error: userErr?.message ?? "Could not create account." };
  }
  const newUserId = created.user.id as string;

  // 3. Insert the merchant_members row.
  const { error: memberErr } = await svc.from("merchant_members").insert({
    merchant_id: merchantId,
    user_id: newUserId,
    role,
    display_name: displayName,
    active: true,
  });

  // 4. On failure, roll back the orphaned auth user.
  if (memberErr) {
    await svc.auth.admin.deleteUser(newUserId);
    return { ok: false, error: memberErr.message };
  }

  return { ok: true };
}
