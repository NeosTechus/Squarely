"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { createBrowserClient } from "@squarely/db/browser";

const fmt = (c: number) => `$${(c / 100).toLocaleString()}`;
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

interface Row {
  id: string;
  name: string;
  subscriptions: { status: string; plans: { tier: string; monthly_price_cents: number } | { tier: string; monthly_price_cents: number }[] | null }[] | null;
}

export default function AdminOverview() {
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("merchants")
        .select("id, name, subscriptions(status, plans(tier, monthly_price_cents))");
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalClients = rows.length;
  let activeSubs = 0;
  let mrrCents = 0;
  const byTier: Record<string, number> = {};
  for (const r of rows) {
    const sub = one<{ status: string; plans: any }>(r.subscriptions);
    if (sub?.status === "active") activeSubs += 1;
    const plan = one<{ tier: string; monthly_price_cents: number }>(sub?.plans ?? null);
    if (plan) {
      byTier[plan.tier] = (byTier[plan.tier] ?? 0) + 1;
      if (sub?.status === "active") mrrCents += plan.monthly_price_cents;
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-bold tracking-tight">Platform overview</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Total clients" value={isLoading ? "…" : String(totalClients)} />
        <Stat label="Active subscriptions" value={isLoading ? "…" : String(activeSubs)} />
        <Stat label="Estimated MRR" value={isLoading ? "…" : fmt(mrrCents)} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Clients by plan</h2>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {["starter", "growth", "pro", "enterprise"].map((t) => (
              <div key={t} className="rounded-xl border border-slate-200 px-4 py-2">
                <div className="text-xs uppercase tracking-wide text-slate-400">{t}</div>
                <div className="text-lg font-bold">{byTier[t] ?? 0}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Link
        href="/admin/clients"
        className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Manage clients →
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
