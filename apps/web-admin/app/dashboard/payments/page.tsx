import { MARKETING_URL } from "@/lib/marketingUrl";

export const metadata = { title: "Payments — Squarely" };

// Payment gateway configuration is managed centrally by the Squarely platform
// team (super admin), so it has been removed from the owner dashboard.
export default function Payments() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-slate-700">
          Your payment gateways are configured for you by your Squarely account
          manager. To add or change a processor (Stripe, Square, PayPal, and
          more), please contact Squarely support.
        </p>
        <a
          href={`${MARKETING_URL}/contact`}
          className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Contact support
        </a>
      </div>
    </div>
  );
}
