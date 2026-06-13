import { getServerSupabase, getServiceSupabase } from "@/lib/supabase";

/**
 * Roles defined on `merchant_members.role`. Mirrors
 * apps/web-admin/app/dashboard/team/roles.ts but kept here as a string union
 * so server-side helpers don't have to import a client-bundle module.
 */
export type MerchantRole =
  | "owner"
  | "admin"
  | "manager"
  | "cashier"
  | "kitchen"
  | "viewer";

export type RoleCheckResult =
  | {
      ok: true;
      userId: string;
      merchantId: string;
      role: MerchantRole | "platform_admin";
    }
  | { ok: false; status: 401 | 403 | 400; error: string };

/**
 * Verify the caller is signed in and either:
 *   - a platform_admin (super-admin / impersonation), OR
 *   - an active merchant_members row for `merchantId` with role ∈ allowedRoles.
 *
 * Used by Server Actions backing high-sensitivity dashboard pages (settings,
 * team, billing, devices) so the privileged DB write never runs unless the
 * caller is actually allowed to perform it. RLS is also expected to enforce
 * this independently — this is defense in depth, plus it produces a clean
 * 401/403 response instead of a generic DB permission error.
 *
 * Defaults to owner/admin (the highest-trust roles) since most callers that
 * need a role check are settings mutations.
 */
export async function requireRole(
  merchantId: string,
  allowedRoles: ReadonlyArray<MerchantRole> = ["owner", "admin"],
): Promise<RoleCheckResult> {
  const mid = merchantId?.trim?.();
  if (!mid) return { ok: false, status: 400, error: "merchantId required" };

  const server = await getServerSupabase();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Not authenticated" };

  // Service-role bypasses RLS so we can authoritatively read membership +
  // platform_admins regardless of the caller's grants on those tables.
  const svc = getServiceSupabase() as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => any;
      };
    };
  };

  const { data: admin } = await svc
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (admin) {
    return { ok: true, userId: user.id, merchantId: mid, role: "platform_admin" };
  }

  const { data: member, error: memberErr } = await svc
    .from("merchant_members")
    .select("role, active")
    .eq("merchant_id", mid)
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (memberErr) {
    return { ok: false, status: 403, error: "Not authorized" };
  }
  const role = (member as { role?: MerchantRole } | null)?.role;
  if (!role || !allowedRoles.includes(role)) {
    return { ok: false, status: 403, error: "Not authorized" };
  }
  return { ok: true, userId: user.id, merchantId: mid, role };
}

/**
 * Resolve the merchant id the current request acts under. Reads
 * `app_metadata.active_merchant_id` from the signed-in JWT (set during
 * sign-up/sign-in and during super-admin impersonation server actions).
 * Falls back to the user's first active membership so a freshly-onboarded
 * user with one merchant still works.
 *
 * Used by high-sensitivity dashboard pages to do a page-level role gate
 * before any client-side UI is rendered.
 */
export async function resolveActiveMerchantId(): Promise<string | null> {
  const server = await getServerSupabase();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user) return null;

  const claim = (user.app_metadata as Record<string, unknown> | undefined)
    ?.active_merchant_id;
  if (typeof claim === "string" && claim) return claim;

  const svc = getServiceSupabase() as unknown as {
    from: (t: string) => {
      select: (cols: string) => { eq: (col: string, val: unknown) => any };
    };
  };
  const { data } = await svc
    .from("merchant_members")
    .select("merchant_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  return (data as { merchant_id?: string } | null)?.merchant_id ?? null;
}
