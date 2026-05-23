"use server";

import { getServiceSupabase, getServerSupabase } from "@/lib/supabase";

export type AdminRow = { userId: string; email: string; createdAt: string };

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Verify the caller is an authenticated platform admin. Returns the
 * service-role client and the caller's user id on success, or an error.
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

/** List all platform admins with their email + created_at, sorted by email. */
export async function listAdmins(): Promise<AdminRow[]> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) throw new Error(auth.error);
  const { svc } = auth;

  const { data: rows, error } = await (svc as any)
    .from("platform_admins")
    .select("user_id, created_at");
  if (error) throw new Error(error.message);

  const result: AdminRow[] = [];
  for (const row of (rows ?? []) as { user_id: string; created_at: string }[]) {
    const { data } = await svc.auth.admin.getUserById(row.user_id);
    result.push({
      userId: row.user_id,
      email: data?.user?.email ?? "(unknown)",
      createdAt: row.created_at,
    });
  }

  result.sort((a, b) => a.email.localeCompare(b.email));
  return result;
}

/** Add an existing user (by email) as a platform admin. */
export async function addAdmin(email: string): Promise<ActionResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { ok: false, error: "Email is required." };

  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { svc } = auth;

  // Find an existing auth user with this email. Page through users.
  let target: { id: string } | null = null;
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return { ok: false, error: error.message };
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === normalized);
    if (match) {
      target = { id: match.id };
      break;
    }
    if (users.length < 1000) break;
    page += 1;
  }

  if (!target) {
    return { ok: false, error: "No user with that email — they must sign up first." };
  }

  const { error } = await (svc as any)
    .from("platform_admins")
    .insert({ user_id: target.id });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

/** Remove a platform admin. Cannot remove yourself. */
export async function removeAdmin(userId: string): Promise<ActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { svc } = auth;

  if (userId === auth.userId) {
    return { ok: false, error: "You cannot remove yourself." };
  }

  const { error } = await (svc as any)
    .from("platform_admins")
    .delete()
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
