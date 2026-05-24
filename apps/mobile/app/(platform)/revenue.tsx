import { useMemo } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

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
}

export default function PlatformRevenue() {
  const { data: subs = [], isLoading: subsLoading } = useQuery({
    queryKey: ["admin-revenue-subs"],
    queryFn: async (): Promise<SubRow[]> => {
      const { data, error } = await (supabase as any)
        .from("subscriptions")
        .select("status, current_period_end, plans(tier, display_name, monthly_price_cents)");
      if (error) throw error;
      return (data ?? []) as SubRow[];
    },
  });

  const { data: merchants = [], isLoading: merchantsLoading } = useQuery({
    queryKey: ["admin-revenue-merchants"],
    queryFn: async (): Promise<MerchantRow[]> => {
      const { data, error } = await (supabase as any)
        .from("merchants")
        .select("id, name, created_at, suspended");
      if (error) throw error;
      return (data ?? []) as MerchantRow[];
    },
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["admin-revenue-orders"],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("merchant_id, created_at, status")
        .neq("status", "cancelled");
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const isLoading = subsLoading || merchantsLoading || ordersLoading;

  const view = useMemo(() => {
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

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const newThisMonth = merchants.filter((m) => new Date(m.created_at) >= monthStart).length;
    const suspended = merchants.filter((m) => m.suspended).length;

    const cutoff = Date.now() - 14 * 864e5;
    const latest: Record<string, number> = {};
    for (const o of orders) {
      const t = new Date(o.created_at).getTime();
      if (!(o.merchant_id in latest) || t > latest[o.merchant_id]!) latest[o.merchant_id] = t;
    }
    const atRisk = merchants
      .filter((m) => !(m.id in latest) || latest[m.id]! < cutoff)
      .map((m) => ({ name: m.name, last: m.id in latest ? new Date(latest[m.id]!) : null }))
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
    <ScreenContainer edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* stat cards */}
        <View className="flex-row flex-wrap gap-3">
          <Stat label="MRR" value={dash(fmt(view.mrr))} hint="active subscriptions" />
          <Stat label="ARR" value={dash(fmt(view.arr))} hint="MRR × 12" />
          <Stat label="Active subscriptions" value={dash(String(view.activeCount))} hint={`${view.churnCount} non-active`} />
          <Stat
            label="New clients this month"
            value={dash(String(view.newThisMonth))}
            hint={`${view.totalClients} total · ${view.suspended} suspended`}
          />
        </View>

        {/* MRR by plan */}
        <View className="rounded-2xl border border-slate-200 bg-white p-5">
          <Text className="mb-4 text-sm font-semibold text-slate-700">MRR by plan</Text>
          {view.tiers.length === 0 ? (
            <Text className="text-sm text-slate-500">{isLoading ? "Loading…" : "No active subscriptions."}</Text>
          ) : (
            <View className="gap-3">
              {view.tiers.map((t) => (
                <View key={t.tier} className="gap-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-slate-700">
                      {t.label} <Text className="text-slate-400">· {t.count} {t.count === 1 ? "client" : "clients"}</Text>
                    </Text>
                    <Text className="text-sm font-semibold text-slate-900">{fmt(t.cents)}/mo</Text>
                  </View>
                  <View className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <View className="h-full rounded-full bg-brand-500" style={{ width: `${(t.cents / view.maxTier) * 100}%` }} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* At-risk clients */}
        <View className="rounded-2xl border border-slate-200 bg-white p-5">
          <Text className="mb-4 text-sm font-semibold text-slate-700">At-risk clients</Text>
          {isLoading ? (
            <Text className="text-sm text-slate-500">Loading…</Text>
          ) : view.atRisk.length === 0 ? (
            <Text className="text-sm font-medium text-emerald-600">All clients active</Text>
          ) : (
            view.atRisk.map((c, i) => (
              <View key={i} className="flex-row items-center justify-between border-b border-slate-50 py-2">
                <Text className="font-medium text-slate-700">{c.name}</Text>
                <Text className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {c.last
                    ? `no orders 14d · ${c.last.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                    : "no orders ever"}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-4" style={{ width: "47%", flexGrow: 1 }}>
      <Text className="text-sm text-slate-500">{label}</Text>
      <Text className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</Text>
      {hint ? <Text className="mt-1 text-xs text-slate-400">{hint}</Text> : null}
    </View>
  );
}
