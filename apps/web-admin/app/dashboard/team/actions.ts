"use server";

import { getServiceSupabase } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { safeErrorMessage } from "@/lib/redact";
import { MERCHANT_ROLES, type MerchantRole } from "./roles";

export type AddTeamMemberResult = { ok: true } | { ok: false; error: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DISPLAY_NAME_LEN = 80;
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 200;

/**
 * Create a new staff member: an auth user + a merchant_members row.
 * Runs server-side with the service-role key because creating auth users and
 * inserting members across users is a privileged action.
 *
 * Security: the caller must be an active owner/admin of `merchantId`. Provider
 * error messages are sanitized through `safeErrorMessage` before being echoed
 * back to the client.
 */
export async function addTeamMember(formData: {
  email: string;
  password: string;
  displayName: string;
  role: MerchantRole;
  merchantId: string;
}): Promise<AddTeamMemberResult> {
  const email = (formData.email ?? "").trim().toLowerCase();
  const password = formData.password ?? "";
  const displayName = (formData.displayName ?? "").trim();
  const role = formData.role;
  const merchantId = (formData.merchantId ?? "").trim();

  // 1. Validate input.
  if (!email || !password || !displayName || !merchantId) {
    return { ok: false, error: "All fields are required." };
  }
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (password.length < MIN_PASSWORD_LEN) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` };
  }
  if (password.length > MAX_PASSWORD_LEN) {
    return { ok: false, error: "Password is too long." };
  }
  if (displayName.length > MAX_DISPLAY_NAME_LEN) {
    return { ok: false, error: `Display name must be ${MAX_DISPLAY_NAME_LEN} characters or fewer.` };
  }
  if (!MERCHANT_ROLES.includes(role)) {
    return { ok: false, error: "Invalid role." };
  }

  // 2. Caller must be owner/admin of this merchant (or a platform admin).
  const guard = await requireRole(merchantId, ["owner", "admin"]);
  if (!guard.ok) return { ok: false, error: guard.error };

  const svc = getServiceSupabase() as unknown as {
    from: (t: string) => any;
    auth: { admin: any };
  };

  // 3. Create the auth user (email pre-confirmed so they can log in immediately).
  const { data: created, error: userErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr || !created?.user) {
    return {
      ok: false,
      error: safeErrorMessage(userErr?.message ?? "Could not create account.", "Could not create account."),
    };
  }
  const newUserId = created.user.id as string;

  // 4. Insert the merchant_members row.
  const { error: memberErr } = await svc.from("merchant_members").insert({
    merchant_id: guard.merchantId,
    user_id: newUserId,
    role,
    display_name: displayName,
    active: true,
  });

  // 5. On failure, roll back the orphaned auth user.
  if (memberErr) {
    await svc.auth.admin.deleteUser(newUserId);
    return { ok: false, error: safeErrorMessage(memberErr.message, "Could not create staff member.") };
  }

  return { ok: true };
}
