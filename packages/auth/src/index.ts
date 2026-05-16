import type { SupabaseClient, Session, User } from "@supabase/supabase-js";
import type { MerchantRole } from "@squarely/types";

export interface SquarelyClaims {
  active_merchant_id?: string;
  role?: MerchantRole;
  /** Plan tier copied into JWT for cheap reads on the client. */
  plan_tier?: string;
}

export interface ResolvedSession {
  user: User;
  session: Session;
  activeMerchantId: string | null;
  role: MerchantRole | null;
  planTier: string | null;
}

/**
 * Reads custom claims from the session's access token. Claims are stamped in
 * by the `auth.jwt-claims` Postgres function on the Supabase side; the user
 * picks an active merchant and we set it via `auth.updateUser({ data })`.
 */
export function readClaims(session: Session | null): SquarelyClaims {
  if (!session?.user?.app_metadata) return {};
  const meta = session.user.app_metadata as Record<string, unknown>;
  return {
    active_merchant_id: meta.active_merchant_id as string | undefined,
    role: meta.role as MerchantRole | undefined,
    plan_tier: meta.plan_tier as string | undefined,
  };
}

export async function resolveSession(
  supabase: SupabaseClient,
): Promise<ResolvedSession | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const claims = readClaims(session);
  return {
    user: session.user,
    session,
    activeMerchantId: claims.active_merchant_id ?? null,
    role: claims.role ?? null,
    planTier: claims.plan_tier ?? null,
  };
}

export async function setActiveMerchant(
  supabase: SupabaseClient,
  merchantId: string,
) {
  return supabase.rpc("set_active_merchant", { p_merchant_id: merchantId });
}

export function hasRole(
  current: MerchantRole | null,
  ...allowed: MerchantRole[]
): boolean {
  return current !== null && allowed.includes(current);
}
