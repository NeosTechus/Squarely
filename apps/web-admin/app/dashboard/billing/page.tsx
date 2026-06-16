import { requireRole, resolveActiveMerchantId } from "@/lib/auth";
import BillingClient from "./BillingClient";

// Server gate — billing information (plan/price) is owner-only commercially
// sensitive data. Future Stripe-checkout wiring will require explicit owner
// authentication anyway, so block at the page entry now.
export default async function BillingPage() {
  const merchantId = await resolveActiveMerchantId();
  if (!merchantId) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-4 text-sm text-slate-600">No active store.</p>
      </div>
    );
  }
  const guard = await requireRole(merchantId, ["owner", "admin"]);
  if (!guard.ok) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-4 text-sm text-slate-600">
          You don&apos;t have permission to view billing. Ask an owner or admin.
        </p>
      </div>
    );
  }
  return <BillingClient />;
}
