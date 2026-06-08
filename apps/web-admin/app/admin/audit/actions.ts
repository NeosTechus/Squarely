"use server";

import { getServiceSupabase, getServerSupabase } from "@/lib/supabase";

export interface ActorInfo {
  email: string | null;
  /** display_name from merchant_members, keyed by merchant_id. */
  displayNameByMerchant: Record<string, string>;
}

export type PurgeResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

/**
 * Verify the caller is an authenticated platform admin. Returns the
 * service-role client and the caller's user id on success.
 *
 * Mirrors apps/web-admin/app/admin/admins/actions.ts:13-32.
 */
async function requirePlatformAdmin(): Promise<
  | { ok: true; svc: ReturnType<typeof getServiceSupabase>; userId: string }
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

  return { ok: true, svc, userId: user.id };
}

/**
 * Look up display info for a batch of actor uuids referenced in the audit log.
 * The browser supabase client cannot read auth.users.email, so this is a
 * server action gated by requirePlatformAdmin().
 *
 * Returns a map keyed by user_id. For each user:
 *   - email: from auth.users (so platform admins not tied to any merchant
 *     still resolve to a human-readable identifier).
 *   - displayNameByMerchant: merchant_members.display_name per (user, merchant)
 *     so audit rows with a merchant_id can show the role-scoped name.
 */
export async function listAuditActors(
  userIds: string[],
): Promise<Record<string, ActorInfo>> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) throw new Error(auth.error);
  const { svc } = auth;

  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const out: Record<string, ActorInfo> = {};

  // Email lookup: one getUserById per unique actor. Audit log volumes are
  // expected to be modest (a few hundred rows per page) and unique actors much
  // fewer — typically a handful of platform admins.
  for (const uid of unique) {
    try {
      const { data } = await svc.auth.admin.getUserById(uid);
      out[uid] = {
        email: data?.user?.email ?? null,
        displayNameByMerchant: {},
      };
    } catch {
      out[uid] = { email: null, displayNameByMerchant: {} };
    }
  }

  if (unique.length) {
    const { data: rows } = await (svc as any)
      .from("merchant_members")
      .select("user_id, merchant_id, display_name")
      .in("user_id", unique);
    for (const r of (rows ?? []) as Array<{
      user_id: string;
      merchant_id: string;
      display_name: string | null;
    }>) {
      let info = out[r.user_id];
      if (!info) {
        info = { email: null, displayNameByMerchant: {} };
        out[r.user_id] = info;
      }
      if (r.display_name) {
        info.displayNameByMerchant[r.merchant_id] = r.display_name;
      }
    }
  }

  return out;
}

/**
 * Delete admin_audit rows older than keepDays. Calls the SECURITY DEFINER
 * RPC public.purge_admin_audit which (a) re-checks is_platform_admin() and
 * (b) self-inserts a 'purge_audit' row recording who purged and how many
 * rows were affected.
 */
export async function purgeAudit(keepDays: number): Promise<PurgeResult> {
  if (!Number.isFinite(keepDays) || keepDays < 1 || keepDays > 3650) {
    return { ok: false, error: "Keep-days must be between 1 and 3650." };
  }

  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { svc } = auth;

  const { data, error } = await (svc as any).rpc("purge_admin_audit", {
    p_keep_days: Math.floor(keepDays),
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, deleted: Number(data ?? 0) };
}
