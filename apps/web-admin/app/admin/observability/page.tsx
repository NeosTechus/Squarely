"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import Reveal from "@/components/Reveal";

const fmt = (c: number) => `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

const OPEN = ["pending", "received", "preparing", "ready"];

type Range = "today" | "7d" | "30d";
const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
];
function rangeStart(r: Range): number {
  const d = new Date();
  if (r === "today") d.setHours(0, 0, 0, 0);
  else if (r === "7d") d.setTime(d.getTime() - 7 * 864e5);
  else d.setTime(d.getTime() - 30 * 864e5);
  return d.getTime();
}

interface OrderRow {
  id: string;
  number: number;
  status: string;
  total_cents: number;
  payment_status: string;
  payment_method: string | null;
  source: string;
  created_at: string;
  merchant_id: string;
  merchants: { name: string } | { name: string }[] | null;
}
interface MerchantRow { id: string; name: string; created_at: string; suspended: boolean }

export default function Observability() {
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };
  const [range, setRange] = useState<Range>("today");

  const { data, isLoading, error, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["observability"],
    refetchInterval: 30_000, // live-ish: refresh every 30s
    queryFn: async () => {
      const since = new Date(Date.now() - 31 * 864e5).toISOString();
      const [{ data: orders }, { data: merchants }] = await Promise.all([
        supabase
          .from("orders")
          .select("id, number, status, total_cents, payment_status, payment_method, source, created_at, merchant_id, merchants(name)")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase.from("merchants").select("id, name, created_at, suspended"),
      ]);
      return { orders: (orders ?? []) as OrderRow[], merchants: (merchants ?? []) as MerchantRow[] };
    },
  });

  const orders = data?.orders ?? [];
  const merchants = data?.merchants ?? [];

  const r0 = rangeStart(range);
  const day7 = Date.now() - 7 * 864e5;
  const hour1 = Date.now() - 60 * 60 * 1000;
  const now = Date.now();
  const mName = (o: OrderRow) => one<{ name: string }>(o.merchants)?.name ?? "Unknown";
  const rangeLabel = range === "today" ? "today" : range === "7d" ? "in 7 days" : "in 30 days";

  // KPIs over the selected range (non-cancelled)
  const inRange = orders.filter((o) => o.status !== "cancelled" && new Date(o.created_at).getTime() >= r0);
  const rangeGmv = inRange.reduce((s, o) => s + o.total_cents, 0);
  const activeStores = new Set(inRange.map((o) => o.merchant_id)).size;
  const newSignups7d = merchants.filter((m) => new Date(m.created_at).getTime() >= day7).length;

  // Order pipeline (open right now) + oldest age
  const openOrders = orders.filter((o) => OPEN.includes(o.status));
  const byStatus: Record<string, number> = {};
  for (const s of OPEN) byStatus[s] = openOrders.filter((o) => o.status === s).length;
  const ageMin = (iso: string) => Math.floor((now - new Date(iso).getTime()) / 60000);
  const oldestOpen = openOrders.reduce<OrderRow | null>((acc, o) => (!acc || new Date(o.created_at) < new Date(acc.created_at) ? o : acc), null);
  const oldestOpenAge = oldestOpen ? ageMin(oldestOpen.created_at) : 0;

  // Payments health (7d)
  const last7 = orders.filter((o) => o.status !== "cancelled" && new Date(o.created_at).getTime() >= day7);
  const paid7 = last7.filter((o) => o.payment_status === "paid").length;
  const unpaid7 = last7.filter((o) => o.payment_status !== "paid").length;
  const unpaidStale = orders.filter((o) => o.payment_status === "unpaid" && o.status !== "cancelled" && new Date(o.created_at).getTime() < hour1).length;
  const methodMix: Record<string, number> = {};
  for (const o of last7.filter((o) => o.payment_status === "paid")) {
    const m = o.payment_method ?? "other";
    methodMix[m] = (methodMix[m] ?? 0) + 1;
  }

  // Cancellations over range
  const rangeAll = orders.filter((o) => new Date(o.created_at).getTime() >= r0);
  const cancelled = rangeAll.filter((o) => o.status === "cancelled").length;
  const cancelRate = rangeAll.length ? Math.round((cancelled / rangeAll.length) * 100) : 0;

  // Volume chart (matches range: hourly today, daily otherwise)
  const buckets: { label: string; count: number }[] = [];
  if (range === "today") {
    for (let h = 0; h < 24; h += 3) buckets.push({ label: `${h}`, count: 0 });
    for (const o of inRange) buckets[Math.floor(new Date(o.created_at).getHours() / 3)]!.count += 1;
  } else {
    const days = range === "7d" ? 7 : 30;
    const base = new Date(); base.setHours(0, 0, 0, 0); base.setDate(base.getDate() - (days - 1));
    for (let i = 0; i < days; i++) {
      const d = new Date(base); d.setDate(d.getDate() + i);
      buckets.push({ label: d.toLocaleDateString(undefined, { day: "numeric" }), count: 0 });
    }
    for (const o of inRange) {
      const idx = Math.floor((new Date(o.created_at).setHours(0, 0, 0, 0) - base.getTime()) / 864e5);
      if (idx >= 0 && idx < days) buckets[idx]!.count += 1;
    }
  }
  const maxBar = Math.max(1, ...buckets.map((b) => b.count));

  // Per-store activity (range)
  const byStore: Record<string, { name: string; count: number; gmv: number }> = {};
  for (const o of inRange) {
    byStore[o.merchant_id] ??= { name: mName(o), count: 0, gmv: 0 };
    byStore[o.merchant_id]!.count += 1;
    byStore[o.merchant_id]!.gmv += o.total_cents;
  }
  const topStores = Object.values(byStore).sort((a, b) => b.gmv - a.gmv).slice(0, 5);
  const activeIds7 = new Set(orders.filter((o) => new Date(o.created_at).getTime() >= day7).map((o) => o.merchant_id));
  const atRisk = merchants.filter((m) => !activeIds7.has(m.id) && !m.suspended);
  const suspended = merchants.filter((m) => m.suspended).length;

  // Alerts
  const stuck = openOrders.filter((o) => ageMin(o.created_at) > 15);
  type Alert = { level: "warn" | "urgent"; text: string };
  const alerts: Alert[] = [];
  if (stuck.length > 0) {
    alerts.push({ level: "urgent", text: `${stuck.length} stuck ticket${stuck.length === 1 ? "" : "s"} (>15 min). Oldest: ${mName(oldestOpen!)} · ${oldestOpenAge}m` });
  }
  if (unpaidStale > 0) alerts.push({ level: "warn", text: `${unpaidStale} unpaid order${unpaidStale === 1 ? "" : "s"} older than 1h` });
  if (atRisk.length > 0) alerts.push({ level: "warn", text: `${atRisk.length} store${atRisk.length === 1 ? "" : "s"} with no orders in 7 days` });
  if (rangeAll.length >= 10 && cancelRate > 10) alerts.push({ level: "warn", text: `High cancellation rate ${rangeLabel}: ${cancelRate}%` });

  const statusPill = (s: string) =>
    s === "completed" ? "bg-emerald-50 text-emerald-700" : s === "cancelled" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Reveal as="h1" className="text-2xl font-bold tracking-tight">Observability</Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {RANGES.map((rg) => (
              <button
                key={rg.key}
                onClick={() => setRange(rg.key)}
                className={`rounded-md px-3 py-1 text-sm font-medium ${range === rg.key ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {rg.label}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className={`h-2 w-2 rounded-full ${isFetching ? "bg-amber-400" : "bg-emerald-500"}`} />
            {isFetching ? "refreshing…" : "live · 30s"}
          </span>
          <button onClick={() => refetch()} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">Refresh</button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{(error as Error).message}</p> : null}

      {/* Alerts */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Alerts</h2>
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : alerts.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" /> All systems normal</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a, i) => (
              <li key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${a.level === "urgent" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                <span>{a.level === "urgent" ? "🔴" : "🟠"}</span>
                {a.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Kpi label={`Orders ${rangeLabel}`} value={isLoading ? "…" : String(inRange.length)} />
        <Kpi label={`GMV ${rangeLabel}`} value={isLoading ? "…" : fmt(rangeGmv)} />
        <Kpi label="Active stores" value={isLoading ? "…" : String(activeStores)} hint={`${merchants.length} total`} />
        <Kpi label="New signups (7d)" value={isLoading ? "…" : String(newSignups7d)} />
      </div>

      {/* Pipeline + Payments */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Order pipeline (open now)">
          <div className="grid grid-cols-2 gap-3">
            {OPEN.map((s) => (
              <div key={s} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">{s}</div>
                <div className="mt-1 text-2xl font-bold">{byStatus[s] ?? 0}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">{openOrders.length} open across platform</span>
            {oldestOpen ? (
              <span className={oldestOpenAge > 15 ? "font-semibold text-red-600" : "text-slate-500"}>oldest {oldestOpenAge}m</span>
            ) : null}
          </div>
        </Card>

        <Card title="Payments health (7d)">
          <div className="flex items-center gap-4">
            <div><div className="text-2xl font-bold text-emerald-600">{paid7}</div><div className="text-xs text-slate-400">paid</div></div>
            <div><div className="text-2xl font-bold text-amber-600">{unpaid7}</div><div className="text-xs text-slate-400">unpaid</div></div>
            <div><div className="text-2xl font-bold text-red-600">{unpaidStale}</div><div className="text-xs text-slate-400">stale &gt;1h</div></div>
          </div>
          <div className="mt-4 space-y-1.5">
            {Object.entries(methodMix).length === 0 ? (
              <p className="text-sm text-slate-400">No paid orders in 7d.</p>
            ) : (
              Object.entries(methodMix).sort((a, b) => b[1] - a[1]).map(([m, n]) => (
                <div key={m} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-slate-600">{m}</span>
                  <span className="font-medium">{n}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Volume + Cancellations */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card title={`Order volume (${range === "today" ? "today, by hour" : rangeLabel})`}>
            <div className="flex h-32 items-end gap-1 overflow-x-auto">
              {buckets.map((b, i) => (
                <div key={i} className="flex min-w-[10px] flex-1 flex-col items-center justify-end gap-1">
                  <div className="w-full rounded-t bg-brand-500" style={{ height: `${(b.count / maxBar) * 100}%`, minHeight: b.count ? 3 : 0 }} title={`${b.label}: ${b.count}`} />
                  <div className="text-[9px] text-slate-400">{b.label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <Card title={`Cancellations ${rangeLabel}`}>
          <div className="text-3xl font-bold text-slate-900">{cancelled}</div>
          <div className={`mt-1 text-sm font-medium ${cancelRate > 10 ? "text-red-600" : "text-slate-500"}`}>{cancelRate}% of {rangeAll.length} orders</div>
        </Card>
      </div>

      {/* Per-store */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={`Top stores ${rangeLabel}`}>
          {topStores.length === 0 ? <p className="text-sm text-slate-400">No sales {rangeLabel}.</p> : (
            <ul className="divide-y divide-slate-100">
              {topStores.map((s) => (
                <li key={s.name} className="flex justify-between py-2 text-sm">
                  <span className="font-medium text-slate-700">{s.name} <span className="text-slate-400">· {s.count}</span></span>
                  <span className="font-semibold">{fmt(s.gmv)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`At-risk stores (${atRisk.length})`}>
          <p className="mb-2 text-xs text-slate-400">No orders in 7 days · {suspended} suspended</p>
          {atRisk.length === 0 ? <p className="text-sm font-medium text-emerald-600">All active stores ordering</p> : (
            <ul className="max-h-44 divide-y divide-slate-100 overflow-y-auto">
              {atRisk.slice(0, 20).map((m) => (
                <li key={m.id} className="py-1.5 text-sm text-slate-600">{m.name}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Live feed */}
      <Card title="Recent orders (live)">
        {isLoading ? <p className="text-sm text-slate-400">Loading…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-2 font-medium">Time</th>
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Store</th>
                  <th className="px-2 py-2 font-medium">Src</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Pay</th>
                  <th className="px-2 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 20).map((o) => (
                  <tr key={o.id} className="border-b border-slate-50 last:border-0">
                    <td className="whitespace-nowrap px-2 py-2 text-slate-500">{new Date(o.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</td>
                    <td className="px-2 py-2 font-medium">#{o.number}</td>
                    <td className="px-2 py-2 text-slate-600">{mName(o)}</td>
                    <td className="px-2 py-2 text-slate-500">{o.source}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusPill(o.status)}`}>{o.status}</span></td>
                    <td className="px-2 py-2 text-slate-500">{o.payment_status === "paid" ? (o.payment_method ?? "paid") : "unpaid"}</td>
                    <td className="px-2 py-2 text-right font-semibold">{fmt(o.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint ? <div className="text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </section>
  );
}
