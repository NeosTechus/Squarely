import { requireRole, resolveActiveMerchantId } from "@/lib/auth";
import LocationsClient from "./LocationsClient";

// Server gate — locations control where orders, devices, and inventory are
// scoped. Mutations (create / rename / deactivate / set default) are owner-
// /admin-only; the server actions also enforce requireRole independently as
// defense in depth. Cashiers and kitchen staff don't need this view.
export default async function LocationsPage() {
  const merchantId = await resolveActiveMerchantId();
  if (!merchantId) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
        <p className="mt-4 text-sm text-slate-600">No active store.</p>
      </div>
    );
  }
  const guard = await requireRole(merchantId, ["owner", "admin"]);
  if (!guard.ok) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
        <p className="mt-4 text-sm text-slate-600">
          You don&apos;t have permission to view locations. Ask an owner or admin.
        </p>
      </div>
    );
  }
  return <LocationsClient merchantId={merchantId} />;
}
