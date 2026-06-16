import { requireRole, resolveActiveMerchantId } from "@/lib/auth";
import SettingsClient from "./SettingsClient";

// Server gate — settings mutations are owner/admin-only, so cashiers etc.
// should not even see the form. The individual server actions also enforce
// requireRole as defense in depth.
export default async function SettingsPage() {
  const merchantId = await resolveActiveMerchantId();
  if (!merchantId) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-4 text-sm text-slate-600">No active store.</p>
      </div>
    );
  }
  const guard = await requireRole(merchantId, ["owner", "admin"]);
  if (!guard.ok) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-4 text-sm text-slate-600">
          You don&apos;t have permission to view store settings. Ask an owner or admin.
        </p>
      </div>
    );
  }
  return <SettingsClient />;
}
