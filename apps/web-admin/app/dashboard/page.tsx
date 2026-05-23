"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import Reveal from "@/components/Reveal";

interface OrderRow {
  total_cents: number;
  status: string;
  created_at: string;
  number: number;
}

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function Dashboard() {
  const { data: merchantId } = useActiveMerchant();
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };

  const { data, isLoading, error } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["dashboard-stats", merchantId],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: orders, error } = await supabase
        .from("orders")
        .select("total_cents, status, created_at, number")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (orders ?? []) as OrderRow[];
    },
  });

  const orders = data ?? [];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todays = orders.filter(
    (o) => new Date(o.created_at) >= startOfDay && o.status !== "cancelled",
  );
  const revenue = todays.reduce((s, o) => s + o.total_cents, 0);
  const orderCount = todays.length;
  const avgTicket = orderCount > 0 ? Math.round(revenue / orderCount) : 0;
  const openTickets = orders.filter((o) =>
    ["pending", "received", "preparing", "ready"].includes(o.status),
  ).length;

  return (
    <div className="space-y-6">
      <Reveal as="h1" className="text-2xl font-bold tracking-tight">
        Overview
      </Reveal>

      {error ? (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Today's revenue", value: isLoading ? "…" : fmt(revenue) },
          { label: "Orders", value: isLoading ? "…" : String(orderCount) },
          { label: "Avg ticket", value: isLoading ? "…" : fmt(avgTicket) },
          { label: "Open tickets", value: isLoading ? "…" : String(openTickets) },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 70}>
            <Stat label={s.label} value={s.value} />
          </Reveal>
        ))}
      </div>

      <Reveal className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-md">
        <h2 className="text-lg font-semibold">Recent orders</h2>
        {isLoading ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            No orders yet. Ring up a sale on the POS app and it will appear here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {orders.slice(0, 10).map((o) => (
              <li
                key={o.number}
                className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2 text-sm transition hover:bg-slate-50"
              >
                <span className="font-medium">Order #{o.number}</span>
                <span className="text-slate-500">{o.status}</span>
                <span className="font-semibold">{fmt(o.total_cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-md">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
