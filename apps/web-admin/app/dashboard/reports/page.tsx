"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";

interface OrderItemRow {
  name_snapshot: string;
  unit_price_cents: number;
  quantity: number;
}

interface OrderRow {
  total_cents: number;
  status: string;
  source: string;
  created_at: string;
  order_items: OrderItemRow[] | null;
}

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Reports() {
  const { data: merchantId } = useActiveMerchant();
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };

  const { data, isLoading, error } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["reports", merchantId],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select(
          "total_cents,status,source,created_at,order_items(name_snapshot,unit_price_cents,quantity)",
        )
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (orders ?? []) as OrderRow[];
    },
  });

  const allOrders = data ?? [];

  // Last 7 days window (including today)
  const startOf7 = new Date();
  startOf7.setHours(0, 0, 0, 0);
  startOf7.setDate(startOf7.getDate() - 6);

  const orders = allOrders.filter((o) => new Date(o.created_at) >= startOf7);
  const counted = orders.filter((o) => o.status !== "cancelled");

  // Headline stats
  const revenue = counted.reduce((s, o) => s + o.total_cents, 0);
  const orderCount = counted.length;
  const avgTicket = orderCount > 0 ? Math.round(revenue / orderCount) : 0;

  // Revenue by day (last 7 days, oldest -> newest)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOf7);
    d.setDate(startOf7.getDate() + i);
    return { date: d, label: DAY_LABELS[d.getDay()], revenue: 0 };
  });
  for (const o of counted) {
    const d = new Date(o.created_at);
    const idx = Math.floor((d.getTime() - startOf7.getTime()) / 86_400_000);
    const bucket = days[idx];
    if (bucket) bucket.revenue += o.total_cents;
  }
  const maxDayRevenue = Math.max(1, ...days.map((d) => d.revenue));

  // Sales by source
  const sources = ["pos", "kiosk"] as const;
  const bySource = sources.map((src) => {
    const rows = counted.filter((o) => o.source === src);
    return {
      source: src,
      count: rows.length,
      revenue: rows.reduce((s, o) => s + o.total_cents, 0),
    };
  });

  // Top items
  const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of counted) {
    for (const li of o.order_items ?? []) {
      const cur = itemMap.get(li.name_snapshot) ?? {
        name: li.name_snapshot,
        qty: 0,
        revenue: 0,
      };
      cur.qty += li.quantity;
      cur.revenue += li.unit_price_cents * li.quantity;
      itemMap.set(li.name_snapshot, cur);
    }
  }
  const topItems = [...itemMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
      <p className="text-sm text-slate-500">Sales analytics for the last 7 days.</p>

      {error ? (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="Revenue (7 days)" value={isLoading ? "…" : fmt(revenue)} />
        <Stat label="Orders" value={isLoading ? "…" : String(orderCount)} />
        <Stat label="Avg ticket" value={isLoading ? "…" : fmt(avgTicket)} />
      </div>

      {/* Revenue by day */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Revenue by day</h2>
        {isLoading ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="mt-6 flex h-48 items-end justify-between gap-3">
            {days.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  {fmt(d.revenue)}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-brand-600 transition-all"
                    style={{
                      height: `${Math.max(2, (d.revenue / maxDayRevenue) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-slate-500">{d.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Sales by source */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Sales by source</h2>
          {isLoading ? (
            <p className="mt-2 text-sm text-slate-500">Loading…</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {bySource.map((s) => (
                <li
                  key={s.source}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <span className="font-medium capitalize">{s.source}</span>
                  <span className="text-slate-500">{s.count} orders</span>
                  <span className="font-semibold">{fmt(s.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top items */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Top items</h2>
          {isLoading ? (
            <p className="mt-2 text-sm text-slate-500">Loading…</p>
          ) : topItems.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No sales yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {topItems.map((it) => (
                <li
                  key={it.name}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <span className="flex-1 font-medium">{it.name}</span>
                  <span className="text-slate-500">×{it.qty}</span>
                  <span className="w-20 text-right font-semibold">
                    {fmt(it.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
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
