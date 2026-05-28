import { useMemo } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

const fmt = (c: number) => `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

const OPEN = ["pending", "received", "preparing", "ready"];

interface OrderRow {
  id: string;
  number: number;
  status: string;
  total_cents: number;
  payment_status: string;
  source: string;
  created_at: string;
  merchant_id: string;
  merchants: { name: string } | { name: string }[] | null;
}

export default function PlatformObservability() {
  // Mirror of the web Observability (/admin/observability): platform-wide,
  // all merchants (RLS gives platform admins read across tenants).
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-observability-orders"],
    refetchInterval: 30000, // live-ish: refresh every 30s
    queryFn: async (): Promise<OrderRow[]> => {
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("id, number, status, total_cents, payment_status, source, created_at, merchant_id, merchants(name)")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const view = useMemo(() => {
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const t0 = startToday.getTime();
    const day7 = Date.now() - 7 * 864e5;
    const hour1 = Date.now() - 60 * 60 * 1000;
    const mName = (o: OrderRow) => one<{ name: string }>(o.merchants)?.name ?? "Unknown";

    // KPIs
    const todays = orders.filter((o) => o.status !== "cancelled" && new Date(o.created_at).getTime() >= t0);
    const todayGmv = todays.reduce((s, o) => s + o.total_cents, 0);
    const activeStoresToday = new Set(todays.map((o) => o.merchant_id)).size;
    const openOrders = orders.filter((o) => OPEN.includes(o.status));

    // Order pipeline (open right now)
    const byStatus: Record<string, number> = {};
    for (const s of OPEN) byStatus[s] = openOrders.filter((o) => o.status === s).length;

    // Payments health (last 7d, non-cancelled)
    const last7 = orders.filter((o) => o.status !== "cancelled" && new Date(o.created_at).getTime() >= day7);
    const paid7 = last7.filter((o) => o.payment_status === "paid").length;
    const unpaid7 = last7.filter((o) => o.payment_status !== "paid").length;
    const unpaidStale = orders.filter(
      (o) => o.payment_status === "unpaid" && o.status !== "cancelled" && new Date(o.created_at).getTime() < hour1
    ).length;

    // Top stores today (by GMV)
    const byStore: Record<string, { name: string; count: number; gmv: number }> = {};
    for (const o of todays) {
      byStore[o.merchant_id] ??= { name: mName(o), count: 0, gmv: 0 };
      byStore[o.merchant_id]!.count += 1;
      byStore[o.merchant_id]!.gmv += o.total_cents;
    }
    const topStores = Object.values(byStore).sort((a, b) => b.gmv - a.gmv).slice(0, 5);

    // Recent feed (latest ~15)
    const recent = orders.slice(0, 15).map((o) => ({
      id: o.id,
      number: o.number,
      name: mName(o),
      status: o.status,
      total_cents: o.total_cents,
      created_at: o.created_at,
    }));

    return {
      todayCount: todays.length,
      todayGmv,
      activeStoresToday,
      openCount: openOrders.length,
      byStatus,
      paid7,
      unpaid7,
      unpaidStale,
      topStores,
      recent,
    };
  }, [orders]);

  const statusPill = (s: string) =>
    s === "completed"
      ? { bg: "bg-emerald-50", text: "text-emerald-700" }
      : s === "cancelled"
        ? { bg: "bg-red-50", text: "text-red-600" }
        : { bg: "bg-amber-50", text: "text-amber-700" };

  return (
    <ScreenContainer edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {isLoading ? (
          <ActivityIndicator className="mt-8" />
        ) : (
          <>
            {/* KPIs */}
            <View className="flex-row flex-wrap gap-3">
              <Stat label="Orders today" value={String(view.todayCount)} />
              <Stat label="GMV today" value={fmt(view.todayGmv)} />
              <Stat label="Active stores today" value={String(view.activeStoresToday)} />
              <Stat label="Open tickets" value={String(view.openCount)} hint="pending → ready" />
            </View>

            {/* Order pipeline */}
            <View className="rounded-2xl border border-slate-200 bg-white p-5">
              <Text className="mb-3 text-sm font-semibold text-slate-700">Order pipeline (open now)</Text>
              <View className="flex-row flex-wrap gap-3">
                {OPEN.map((s) => (
                  <View key={s} className="rounded-xl border border-slate-200 px-4 py-2" style={{ minWidth: "47%", flexGrow: 1 }}>
                    <Text className="text-xs uppercase tracking-wide text-slate-400">{s}</Text>
                    <Text className="mt-1 text-2xl font-bold">{view.byStatus[s] ?? 0}</Text>
                  </View>
                ))}
              </View>
              <Text className="mt-3 text-sm text-slate-500">{view.openCount} open across platform</Text>
            </View>

            {/* Payments health */}
            <View className="rounded-2xl border border-slate-200 bg-white p-5">
              <Text className="mb-3 text-sm font-semibold text-slate-700">Payments health (7d)</Text>
              <View className="flex-row gap-6">
                <View>
                  <Text className="text-2xl font-bold text-emerald-600">{view.paid7}</Text>
                  <Text className="text-xs text-slate-400">paid</Text>
                </View>
                <View>
                  <Text className="text-2xl font-bold text-amber-600">{view.unpaid7}</Text>
                  <Text className="text-xs text-slate-400">unpaid</Text>
                </View>
                <View>
                  <Text className="text-2xl font-bold text-red-600">{view.unpaidStale}</Text>
                  <Text className="text-xs text-slate-400">stale &gt;1h</Text>
                </View>
              </View>
            </View>

            {/* Top stores today */}
            <View className="rounded-2xl border border-slate-200 bg-white p-5">
              <Text className="mb-3 text-sm font-semibold text-slate-700">Top stores today</Text>
              {view.topStores.length === 0 ? (
                <Text className="text-sm text-slate-500">No sales today.</Text>
              ) : (
                view.topStores.map((s, i) => (
                  <View key={i} className="flex-row justify-between border-b border-slate-50 py-2">
                    <Text className="font-medium text-slate-700">
                      {s.name} <Text className="text-slate-400">· {s.count}</Text>
                    </Text>
                    <Text className="font-semibold">{fmt(s.gmv)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Recent orders feed */}
            <View className="rounded-2xl border border-slate-200 bg-white p-5">
              <Text className="mb-3 text-sm font-semibold text-slate-700">Recent orders (live)</Text>
              {view.recent.length === 0 ? (
                <Text className="text-sm text-slate-500">No recent orders.</Text>
              ) : (
                view.recent.map((o) => (
                  <View key={o.id} className="flex-row items-center justify-between border-b border-slate-50 py-2">
                    <View className="flex-1 pr-2">
                      <Text className="font-medium text-slate-700" numberOfLines={1}>
                        #{o.number} · {o.name}
                      </Text>
                      <Text className="text-xs text-slate-400">
                        {new Date(o.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </Text>
                    </View>
                    <View className={`mr-2 rounded-full px-2 py-0.5 ${statusPill(o.status).bg}`}>
                      <Text className={`text-xs font-medium ${statusPill(o.status).text}`}>{o.status}</Text>
                    </View>
                    <Text className="font-semibold">{fmt(o.total_cents)}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-4" style={{ width: "47%", flexGrow: 1 }}>
      <Text className="text-xs uppercase tracking-wide text-slate-500">{label}</Text>
      <Text className="mt-1 text-2xl font-bold">{value}</Text>
      {hint ? <Text className="text-xs text-slate-400">{hint}</Text> : null}
    </View>
  );
}
