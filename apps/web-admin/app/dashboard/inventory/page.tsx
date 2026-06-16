import { requireRole, resolveActiveMerchantId } from "@/lib/auth";
import InventoryClient from "./InventoryClient";

// Server gate — the new RLS (20260615000000_tighten_sensitive_rls)
// restricts inventory_levels writes to owner/admin/manager. Without
// this gate, cashier/kitchen/viewer roles would see the edit form
// render but every save would silently fail at the DB layer.
//
// Mirror the existing gate pattern on /dashboard/{settings,devices,
// billing,team}: render a friendly "ask an owner" message for the
// excluded roles rather than letting the UI break.
export default async function InventoryPage() {
  const merchantId = await resolveActiveMerchantId();
  if (!merchantId) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <p className="mt-4 text-sm text-slate-600">No active store.</p>
      </div>
    );
  }
  const guard = await requireRole(merchantId, ["owner", "admin", "manager"]);
  if (!guard.ok) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <p className="mt-4 text-sm text-slate-600">
          You don&apos;t have permission to edit inventory. Ask an owner,
          admin, or manager.
        </p>
      </div>
    );
  }
  return <InventoryClient />;
}
