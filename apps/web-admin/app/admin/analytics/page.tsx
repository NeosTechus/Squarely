"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import Reveal from "@/components/Reveal";

type Period = "today" | "week" | "month" | "year" | "custom";
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const fmt = (c: number) => `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

interface OrderRow {
  total_cents: number;
  status: string;
  created_at: string;
  merchant_id: string;
  merchants: { name: string } | { name: string }[] | null;
}

/** Returns the current window and the equivalent previous window for comparison. */
function ranges(period: Period, from: string, to: string) {
  const now = new Date();
  let start: Date;
  let end: Date = now;
  if (period === "custom" && from && to) {
    start = new Date(from + "T00:00:00");
    end = new Date(to + "T23:59:59");
  } else if (period === "today") {
    start = new Date();
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    start = new Date();
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else {
    start = new Date();
    start.setMonth(start.getMonth() - 11);
    start.setHours(0, 0, 0, 0);
  }
  const len = end.getTime() - start.getTime();
  return { start, end, prevStart: new Date(start.getTime() - len), prevEnd: start };
}

export default function AnalyticsPage() {
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };
  const [period, setPeriod] = useState<Period>("week");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-analytics-orders"],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("total_cents, status, created_at, merchant_id, merchants(name)")
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const { data: mrrCents = 0 } = useQuery({
    queryKey: ["admin-analytics-mrr"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, plans(monthly_price_cents)")
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []).reduce((s: number, r: any) => {
        const p = one<{ monthly_price_cents: number }>(r.plans);
        return s + (p?.monthly_price_cents ?? 0);
      }, 0);
    },
  });

  const view = useMemo(() => {
    const { start, end, prevStart, prevEnd } = ranges(period, from, to);
    const inRange = (d: Date, a: Date, b: Date) => d >= a && d <= b;

    const cur = orders.filter((o) => inRange(new Date(o.created_at), start, end));
    const prev = orders.filter((o) => inRange(new Date(o.created_at), prevStart, prevEnd));

    const gmv = cur.reduce((s, o) => s + o.total_cents, 0);
    const prevGmv = prev.reduce((s, o) => s + o.total_cents, 0);
    const count = cur.length;
    const prevCount = prev.length;
    const avg = count ? Math.round(gmv / count) : 0;
    const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100));

    // daily (or hourly for today) buckets across the current window
    const buckets: { label: string; cents: number }[] = [];
    const hourly = period === "today";
    if (hourly) {
      for (let h = 0; h < 24; h += 3) buckets.push({ label: `${h}:00`, cents: 0 });
      for (const o of cur) buckets[Math.floor(new Date(o.created_at).getHours() / 3)]!.cents += o.total_cents;
    } else {
      const days = Math.min(62, Math.max(1, Math.round((end.getTime() - start.getTime()) / 864e5) + 1));
      const useMonths = days > 62;
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        buckets.push({ label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), cents: 0 });
      }
      const startMs = new Date(start).setHours(0, 0, 0, 0);
      for (const o of cur) {
        const idx = Math.floor((new Date(o.created_at).setHours(0, 0, 0, 0) - startMs) / 864e5);
        if (idx >= 0 && idx < buckets.length) buckets[idx]!.cents += o.total_cents;
      }
      void useMonths;
    }

    const byClient: Record<string, { name: string; cents: number }> = {};
    for (const o of cur) {
      const name = one<{ name: string }>(o.merchants)?.name ?? "Unknown";
      byClient[o.merchant_id] ??= { name, cents: 0 };
      byClient[o.merchant_id]!.cents += o.total_cents;
    }
    const top = Object.values(byClient).sort((a, b) => b.cents - a.cents).slice(0, 5);
    const best = [...buckets].sort((a, b) => b.cents - a.cents)[0];

    return {
      gmv, count, avg,
      gmvDelta: delta(gmv, prevGmv),
      countDelta: delta(count, prevCount),
      buckets, top, best,
    };
  }, [orders, period, from, to]);

  const maxBar = Math.max(1, ...view.buckets.map((b) => b.cents));
  const label = period === "custom" ? "range" : period;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Reveal as="h1" className="text-2xl font-bold tracking-tight">Analytics</Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`rounded-md px-3 py-1 text-sm font-medium ${
                  period === p.key ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* calendar / custom range */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1">
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); if (e.target.value && to) setPeriod("custom"); }}
              className="text-sm text-slate-700 focus:outline-none"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); if (from && e.target.value) setPeriod("custom"); }}
              className="text-sm text-slate-700 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          <Stat key="gmv" label="Client sales (GMV)" value={isLoading ? "…" : fmt(view.gmv)} delta={view.gmvDelta} />,
          <Stat key="orders" label="Orders" value={isLoading ? "…" : String(view.count)} delta={view.countDelta} />,
          <Stat key="avg" label="Avg ticket" value={isLoading ? "…" : fmt(view.avg)} />,
          <Stat key="mrr" label="Platform MRR" value={fmt(mrrCents)} hint="active subscriptions" />,
        ].map((card, i) => (
          <Reveal key={i} delay={i * 70}>
            {card}
          </Reveal>
        ))}
      </div>

      {/* improvement insights */}
      <Reveal as="section" className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Insights</h2>
        <ul className="space-y-1 text-sm text-slate-600">
          <li>
            {view.gmvDelta >= 0 ? "📈" : "📉"} Sales are{" "}
            <strong className={view.gmvDelta >= 0 ? "text-emerald-600" : "text-red-600"}>
              {view.gmvDelta >= 0 ? "up" : "down"} {Math.abs(view.gmvDelta)}%
            </strong>{" "}
            vs the previous {label}.
          </li>
          {view.best && view.best.cents > 0 ? (
            <li>🏅 Best {period === "today" ? "time" : "day"}: <strong>{view.best.label}</strong> ({fmt(view.best.cents)}).</li>
          ) : null}
          {view.top[0] ? (
            <li>👑 Top client: <strong>{view.top[0].name}</strong> ({fmt(view.top[0].cents)}).</li>
          ) : null}
          <li>🧾 Avg ticket this {label}: <strong>{fmt(view.avg)}</strong>.</li>
        </ul>
      </Reveal>

      <Reveal as="section" delay={70} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Sales over {label}</h2>
        <div className="flex h-44 items-end gap-1 overflow-x-auto">
          {view.buckets.map((b, i) => (
            <div key={i} className="flex min-w-[18px] flex-1 flex-col items-center justify-end gap-1">
              <div
                className="w-full rounded-t bg-brand-500"
                style={{ height: `${(b.cents / maxBar) * 100}%`, minHeight: b.cents ? 4 : 0 }}
                title={`${b.label}: ${fmt(b.cents)}`}
              />
              <div className="text-[9px] text-slate-500">{b.label}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" delay={140} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Top clients ({label})</h2>
        {view.top.length === 0 ? (
          <p className="text-sm text-slate-500">No sales in this period.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {view.top.map((c) => (
              <li key={c.name} className="-mx-2 flex justify-between rounded px-2 py-2 text-sm transition hover:bg-slate-50">
                <span className="font-medium">{c.name}</span>
                <span className="font-semibold">{fmt(c.cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </div>
  );
}

function Stat({ label, value, hint, delta }: { label: string; value: string; hint?: string; delta?: number }) {
  return (
    <div className="h-full rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-md">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {delta !== undefined ? (
        <div className={`text-xs font-medium ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs prev
        </div>
      ) : hint ? (
        <div className="text-xs text-slate-400">{hint}</div>
      ) : null}
    </div>
  );
}
