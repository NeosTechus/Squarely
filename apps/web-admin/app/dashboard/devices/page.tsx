import { requireRole, resolveActiveMerchantId } from "@/lib/auth";
import DevicesClient from "./DevicesClient";

// Server gate — device/printer/terminal config (incl. LAN IP+port, default
// printer selection, activation) is owner/admin-only. The mutation server
// actions also enforce requireRole independently.
export default async function DevicesPage() {
  const merchantId = await resolveActiveMerchantId();
  if (!merchantId) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
        <p className="mt-4 text-sm text-slate-600">No active store.</p>
      </div>
    );
  }
  const guard = await requireRole(merchantId, ["owner", "admin"]);
  if (!guard.ok) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
        <p className="mt-4 text-sm text-slate-600">
          You don&apos;t have permission to view devices. Ask an owner or admin.
        </p>
      </div>
    );
  }
  return <DevicesClient />;
}
