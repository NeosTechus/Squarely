"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { updatePlan } from "./actions";
import Reveal from "@/components/Reveal";

interface PlanRow {
  id: string;
  tier: string;
  display_name: string;
  monthly_price_cents: number;
  yearly_price_cents: number;
  device_limit: number | null;
  features: string[];
}

const centsToDollars = (c: number) => (c / 100).toString();
const dollarsToCents = (d: string) => Math.round((parseFloat(d) || 0) * 100);

export default function PlansPage() {
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };

  const { data: plans = [], isLoading, error } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async (): Promise<PlanRow[]> => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, tier, display_name, monthly_price_cents, yearly_price_cents, device_limit, features")
        .order("monthly_price_cents");
      if (error) throw error;
      return (data ?? []) as PlanRow[];
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <Reveal>
        <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
        <p className="mt-2 text-sm text-slate-600">
          Edit the subscription tiers offered to merchants. Prices are shown in dollars.
        </p>
      </Reveal>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      ) : (
        <div className="space-y-4">
          {plans.map((p, i) => (
            <Reveal key={p.id} delay={i * 70}>
              <PlanCard plan={p} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanRow }) {
  const qc = useQueryClient();

  const [displayName, setDisplayName] = useState(plan.display_name);
  const [monthly, setMonthly] = useState(centsToDollars(plan.monthly_price_cents));
  const [yearly, setYearly] = useState(centsToDollars(plan.yearly_price_cents));
  const [deviceLimit, setDeviceLimit] = useState(
    plan.device_limit == null ? "" : String(plan.device_limit),
  );
  const [features, setFeatures] = useState((plan.features ?? []).join(", "));
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const trimmed = deviceLimit.trim();
      const r = await updatePlan({
        id: plan.id,
        display_name: displayName,
        monthly_price_cents: dollarsToCents(monthly),
        yearly_price_cents: dollarsToCents(yearly),
        device_limit: trimmed === "" ? null : Math.round(Number(trimmed)),
        features: features
          .split(",")
          .map((f) => f.trim())
          .filter((f) => f.length > 0),
      });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      setStatus({ ok: true, text: "Saved." });
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (e) => setStatus({ ok: false, text: (e as Error).message }),
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
      <div className="mb-4 text-xs uppercase tracking-wide text-slate-400">{plan.tier}</div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
          />
        </Field>
        <Field label="Device limit (empty = unlimited)">
          <input
            type="number"
            min={0}
            value={deviceLimit}
            onChange={(e) => setDeviceLimit(e.target.value)}
            placeholder="Unlimited"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
          />
        </Field>
        <Field label="Monthly price ($)">
          <input
            type="number"
            min={0}
            step="0.01"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
          />
        </Field>
        <Field label="Yearly price ($)">
          <input
            type="number"
            min={0}
            step="0.01"
            value={yearly}
            onChange={(e) => setYearly(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Features (comma-separated)">
            <input
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
            />
          </Field>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {mut.isPending ? "Saving…" : "Save"}
        </button>
        {status ? (
          <span className={`text-sm ${status.ok ? "text-emerald-600" : "text-red-600"}`}>
            {status.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}
