"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";

type PlanTier = "starter" | "growth" | "pro" | "enterprise";
type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "paused";

interface Plan {
  id: string;
  tier: PlanTier;
  display_name: string;
  monthly_price_cents: number;
  yearly_price_cents: number;
  device_limit: number | null;
  features: string[];
}

interface CurrentSubscription {
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  plans: {
    display_name: string;
    monthly_price_cents: number;
    device_limit: number | null;
    features: string[];
    tier: PlanTier;
  } | null;
}

const fmt = (c: number) => (c === 0 ? "Free" : `$${(c / 100).toFixed(2)}`);

const fmtPlanPrice = (c: number) =>
  c === 0 ? "Free" : `${fmt(c)}/mo`;

const fmtDevices = (n: number | null) =>
  n === null ? "Unlimited devices" : `${n} device${n === 1 ? "" : "s"}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  active: "bg-green-100 text-green-700",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-amber-100 text-amber-700",
  paused: "bg-slate-100 text-slate-600",
  incomplete: "bg-amber-100 text-amber-700",
  canceled: "bg-red-100 text-red-700",
};

export default function Billing() {
  const { data: merchantId } = useActiveMerchant();

  // The generated Database types are empty in this scaffold, so the typed
  // query builder resolves to `never`; use an untyped client for these calls.
  const supabase = createBrowserClient() as unknown as {
    from: (t: string) => any;
  };

  const {
    data: subscription,
    isLoading: subLoading,
    error: subError,
  } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["subscription", merchantId],
    queryFn: async (): Promise<CurrentSubscription | null> => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "status, current_period_end, current_period_start, plans(display_name, monthly_price_cents, device_limit, features, tier)"
        )
        .eq("merchant_id", merchantId)
        .maybeSingle();
      if (error) throw error;
      return (data as CurrentSubscription) ?? null;
    },
  });

  const {
    data: plans = [],
    isLoading: plansLoading,
    error: plansError,
  } = useQuery({
    queryKey: ["plans"],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase
        .from("plans")
        .select(
          "id, tier, display_name, monthly_price_cents, yearly_price_cents, device_limit, features"
        )
        .order("monthly_price_cents");
      if (error) throw error;
      return (data as Plan[]) ?? [];
    },
  });

  const currentTier = subscription?.plans?.tier ?? null;

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Billing</h1>

      {/* Current plan */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Current plan
        </h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          {subLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : subError ? (
            <p className="text-sm text-red-600">{(subError as Error).message}</p>
          ) : !subscription || !subscription.plans ? (
            <p className="text-sm text-slate-500">
              No active subscription. Choose a plan below to get started.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">
                      {subscription.plans.display_name}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        STATUS_STYLES[subscription.status]
                      }`}
                    >
                      {subscription.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Renews {fmtDate(subscription.current_period_end)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold">
                    {fmt(subscription.plans.monthly_price_cents)}
                  </span>
                  {subscription.plans.monthly_price_cents > 0 ? (
                    <span className="text-sm text-slate-500">/mo</span>
                  ) : null}
                </div>
              </div>
              <p className="text-sm text-slate-600">
                {fmtDevices(subscription.plans.device_limit)}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Available plans */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Available plans
        </h2>
        {plansLoading ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading…
          </p>
        ) : plansError ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-red-600">
            {(plansError as Error).message}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => {
              const isCurrent = plan.tier === currentTier;
              return (
                <div
                  key={plan.id}
                  className={`flex flex-col rounded-2xl border bg-white p-6 ${
                    isCurrent ? "border-brand-600 ring-1 ring-brand-600" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{plan.display_name}</span>
                    {isCurrent ? (
                      <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-medium text-white">
                        Current
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3">
                    <span className="text-2xl font-bold">
                      {fmtPlanPrice(plan.monthly_price_cents)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {fmtDevices(plan.device_limit)}
                  </p>

                  {plan.features.length > 0 ? (
                    <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                      {plan.features.map((f) => (
                        <li key={f} className="flex gap-2">
                          <span className="text-brand-600">✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-auto pt-5">
                    {isCurrent ? (
                      <p className="text-xs text-slate-400">Your current plan</p>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled
                          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white opacity-50"
                          title="Stripe Checkout wiring comes later"
                        >
                          Upgrade
                        </button>
                        <p className="mt-2 text-xs text-slate-400">
                          Checkout coming soon — requires Stripe keys.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
