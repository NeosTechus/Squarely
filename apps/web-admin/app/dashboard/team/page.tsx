import { requireRole, resolveActiveMerchantId } from "@/lib/auth";
import TeamClient from "./TeamClient";

// Server gate — only owners/admins can view or manage the team. Cashiers
// or kitchen staff don't need to see who has access to the store. The
// `addTeamMember` server action enforces requireRole independently.
export default async function TeamPage() {
  const merchantId = await resolveActiveMerchantId();
  if (!merchantId) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="mt-4 text-sm text-slate-600">No active store.</p>
      </div>
    );
  }
  const guard = await requireRole(merchantId, ["owner", "admin"]);
  if (!guard.ok) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="mt-4 text-sm text-slate-600">
          You don&apos;t have permission to view the team. Ask an owner or admin.
        </p>
      </div>
    );
  }
  return <TeamClient />;
}
