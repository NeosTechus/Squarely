"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";

interface OrderRow {
  id: string;
  number: number;
  status: string;
  source: string;
  total_cents: number;
  payment_status: string;
  created_at: string;
}

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function Orders() {
  const { data: merchantId } = useActiveMerchant();
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };

  const { data: orders = [], isLoading, error } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["orders", merchantId],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, number, status, source, total_cents, payment_status, created_at")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Orders</h1>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {isLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">{(error as Error).message}</p>
        ) : orders.length === 0 ? (
          <p className="p-6 text-sm text-slate-600">
            No orders yet. Charge a sale on the POS app and it will show here.
          </p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Order</th>
                <th className="px-6 py-3">Source</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Payment</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-6 py-3 font-medium">#{o.number}</td>
                  <td className="px-6 py-3 text-slate-600">{o.source}</td>
                  <td className="px-6 py-3 text-slate-600">{o.status}</td>
                  <td className="px-6 py-3 text-slate-600">{o.payment_status}</td>
                  <td className="px-6 py-3 text-right font-semibold">{fmt(o.total_cents)}</td>
                  <td className="px-6 py-3 text-right text-slate-500">
                    {new Date(o.created_at).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
