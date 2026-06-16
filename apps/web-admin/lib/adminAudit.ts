import { getServiceSupabase } from "@/lib/supabase";

type Svc = ReturnType<typeof getServiceSupabase>;

/**
 * Best-effort insert into admin_audit. Wrapped so a logging failure never
 * breaks the action that triggered it. merchant_id is nullable in the schema
 * (FK is on-delete-set-null) — pass null for platform-wide actions like
 * addAdmin / updatePlan / createAnnouncement where there's no tenant context.
 *
 * Shared between /admin/clients, /admin/admins, /admin/plans,
 * /admin/announcements and /api/refunds.
 */
export async function recordAudit(
  svc: Svc,
  row: {
    actor: string;
    action: string;
    merchant_id?: string | null;
    detail?: string | null;
  },
): Promise<void> {
  try {
    await (svc as any).from("admin_audit").insert({
      actor: row.actor,
      action: row.action,
      merchant_id: row.merchant_id ?? null,
      detail: row.detail ?? null,
    });
  } catch {
    // Swallow: auditing must never break the underlying action.
  }
}
