"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import Reveal from "@/components/Reveal";

const fmt = (c: number) => "$" + (c / 100).toLocaleString();
const one = <T,>(v: any): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

interface PlanRef {
  tier: string;
  display_name: string;
  monthly_price_cents: number;
}
interface SubRow {
  status: string;
  current_period_end: string | null;
  plans: PlanRef | PlanRef[] | null;
}
interface MerchantRow {
  id: string;
  name: string;
  created_at: string;
  suspended: boolean;
}
interface OrderRow {
  merchant_id: string;
  created_at: string;
  status: string;
  merchants: { name: string } | { name: string }[] | null;
}

export default function RevenuePage() {
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };

  const { data: subs = [], isLoading: subsLoading } = useQuery({
    queryKey: ["admin-revenue-subs"],
    queryFn: async (): Promise<SubRow[]> => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, current_period_end, plans(tier, display_name, monthly_price_cents)");
      if (error) throw error;
      return (data ?? []) as SubRow[];
    },
  });

  const { data: merchants = [], isLoading: merchantsLoading } = useQuery({
    queryKey: ["admin-revenue-merchants"],
    queryFn: async (): Promise<MerchantRow[]> => {
      const { data, error } = await supabase
        .from("merchants")
        .select("id, name, created_at, suspended");
      if (error) throw error;
      return (data ?? []) as MerchantRow[];
    },
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["admin-revenue-orders"],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("merchant_id, created_at, status, merchants(name)")
        .neq("status", "cancelled");
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const isLoading = subsLoading || merchantsLoading || ordersLoading;

  const view = useMemo(() => {
    // --- Subscriptions / MRR ---
    const active = subs.filter((s) => s.status === "active");
    const churned = subs.filter((s) => s.status !== "active");
    let mrr = 0;
    const byTier: Record<string, { tier: string; label: string; cents: number; count: number }> = {};
    for (const s of active) {
      const p = one<PlanRef>(s.plans);
      const cents = p?.monthly_price_cents ?? 0;
      mrr += cents;
      const tier = p?.tier ?? "unknown";
      byTier[tier] ??= { tier, label: p?.display_name ?? tier, cents: 0, count: 0 };
      byTier[tier]!.cents += cents;
      byTier[tier]!.count += 1;
    }
    const tiers = Object.values(byTier).sort((a, b) => b.cents - a.cents);

    // --- Merchants ---
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const newThisMonth = merchants.filter((m) => new Date(m.created_at) >= monthStart).length;
    const suspended = merchants.filter((m) => m.suspended).length;

    // --- Client health: at-risk = no order in last 14 days (or never) ---
    const cutoff = Date.now() - 14 * 864e5;
    const latest: Record<string, number> = {};
    for (const o of orders) {
      const t = new Date(o.created_at).getTime();
      if (!(o.merchant_id in latest) || t > latest[o.merchant_id]!) latest[o.merchant_id] = t;
    }
    const atRisk = merchants
      .filter((m) => !(m.id in latest) || latest[m.id]! < cutoff)
      .map((m) => ({
        name: m.name,
        last: m.id in latest ? new Date(latest[m.id]!) : null,
      }))
      .sort((a, b) => (a.last?.getTime() ?? 0) - (b.last?.getTime() ?? 0));

    return {
      mrr,
      arr: mrr * 12,
      activeCount: active.length,
      churnCount: churned.length,
      tiers,
      maxTier: Math.max(1, ...tiers.map((t) => t.cents)),
      totalClients: merchants.length,
      newThisMonth,
      suspended,
      atRisk,
    };
  }, [subs, merchants, orders]);

  const dash = (v: string) => (isLoading ? "…" : v);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <Reveal as="h1" className="text-2xl font-bold tracking-tight">Revenue &amp; health</Reveal>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        {[
          <Stat key="mrr" label="MRR" value={dash(fmt(view.mrr))} hint="active subscriptions" />,
          <Stat key="arr" label="ARR" value={dash(fmt(view.arr))} hint="MRR × 12" />,
          <Stat key="active" label="Active subscriptions" value={dash(String(view.activeCount))} hint={`${view.churnCount} non-active`} />,
          <Stat key="new" label="New clients this month" value={dash(String(view.newThisMonth))} hint={`${view.totalClients} total · ${view.suspended} suspended`} />,
        ].map((card, i) => (
          <Reveal key={i} delay={i * 70}>
            {card}
          </Reveal>
        ))}
      </div>

      <Reveal as="section" delay={70} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">MRR by plan</h2>
        {view.tiers.length === 0 ? (
          <p className="text-sm text-slate-500">{isLoading ? "Loading…" : "No active subscriptions."}</p>
        ) : (
          <div className="space-y-3">
            {view.tiers.map((t) => (
              <div key={t.tier} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">
                    {t.label}{" "}
                    <span className="text-slate-400">· {t.count} {t.count === 1 ? "client" : "clients"}</span>
                  </span>
                  <span className="font-semibold text-slate-900">{fmt(t.cents)}/mo</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${(t.cents / view.maxTier) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Reveal>

      <Reveal as="section" delay={140} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">At-risk clients</h2>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : view.atRisk.length === 0 ? (
          <p className="text-sm font-medium text-emerald-600">All clients active</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {view.atRisk.map((c, i) => (
              <li key={i} className="-mx-2 flex flex-wrap items-center justify-between gap-2 rounded px-2 py-2 text-sm transition hover:bg-slate-50">
                <span className="font-medium text-slate-700">{c.name}</span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {c.last
                    ? `no orders in 14d · last ${c.last.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                    : "no orders ever"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}
