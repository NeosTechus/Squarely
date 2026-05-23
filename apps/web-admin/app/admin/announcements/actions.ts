"use server";

import { getServiceSupabase, getServerSupabase } from "@/lib/supabase";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  active: boolean;
  created_at: string;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

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

/** List all announcements, newest first. */
export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) throw new Error(auth.error);
  const { svc } = auth;

  const { data, error } = await (svc as any)
    .from("announcements")
    .select("id, title, body, active, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []) as AnnouncementRow[];
}

/** Create a new announcement (active by default). */
export async function createAnnouncement(input: {
  title: string;
  body: string;
}): Promise<ActionResult> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (!body) return { ok: false, error: "Body is required." };

  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { svc } = auth;

  const { error } = await (svc as any)
    .from("announcements")
    .insert({ title, body, active: true });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

/** Toggle an announcement's active state. */
export async function setAnnouncementActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { svc } = auth;

  const { error } = await (svc as any)
    .from("announcements")
    .update({ active })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

/** Delete an announcement. */
export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth;
  const { svc } = auth;

  const { error } = await (svc as any)
    .from("announcements")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
