import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

type Period = "today" | "week" | "month" | "year";
const PERIODS: Period[] = ["today", "week", "month", "year"];
const fmt = (c: number) => `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

function start(p: Period): Date {
  const d = new Date();
  if (p === "today") d.setHours(0, 0, 0, 0);
  else if (p === "week") { d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); }
  else if (p === "month") { d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); }
  else { d.setMonth(d.getMonth() - 11); d.setHours(0, 0, 0, 0); }
  return d;
}

interface OrderRow { total_cents: number; created_at: string; merchant_id: string; merchants: { name: string } | { name: string }[] | null; }

export default function PlatformAnalytics() {
  const [period, setPeriod] = useState<Period>("week");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["platform-analytics-orders"],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("total_cents, created_at, merchant_id, merchants(name)")
        .neq("status", "cancelled");
      if (error) throw error;
      return data ?? [];
    },
  });

  const view = useMemo(() => {
    const s = start(period).getTime();
    const cur = orders.filter((o) => new Date(o.created_at).getTime() >= s);
    const gmv = cur.reduce((a, o) => a + o.total_cents, 0);
    const count = cur.length;
    const byClient: Record<string, { name: string; cents: number }> = {};
    for (const o of cur) {
      const name = one<{ name: string }>(o.merchants)?.name ?? "Unknown";
      byClient[o.merchant_id] ??= { name, cents: 0 };
      byClient[o.merchant_id]!.cents += o.total_cents;
    }
    const top = Object.values(byClient).sort((a, b) => b.cents - a.cents).slice(0, 5);
    return { gmv, count, avg: count ? Math.round(gmv / count) : 0, top };
  }, [orders, period]);

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "Analytics" }} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="flex-row gap-2">
          {PERIODS.map((p) => (
            <Pressable key={p} onPress={() => setPeriod(p)}
              className={`rounded-lg px-3 py-2 ${period === p ? "bg-brand-600" : "bg-slate-100"}`}>
              <Text className={`text-sm font-medium capitalize ${period === p ? "text-white" : "text-slate-600"}`}>{p}</Text>
            </Pressable>
          ))}
        </View>

        {isLoading ? <ActivityIndicator className="mt-8" /> : (
          <>
            <View className="mt-4 flex-row gap-3">
              <Stat label="Sales (GMV)" value={fmt(view.gmv)} />
              <Stat label="Orders" value={String(view.count)} />
              <Stat label="Avg" value={fmt(view.avg)} />
            </View>

            <Text className="mt-6 mb-2 text-sm font-semibold text-slate-700">Top clients ({period})</Text>
            <View className="rounded-2xl border border-slate-200 bg-white">
              {view.top.length === 0 ? (
                <Text className="p-4 text-sm text-slate-400">No sales in this period.</Text>
              ) : view.top.map((c, i) => (
                <View key={i} className="flex-row justify-between border-b border-slate-50 p-3">
                  <Text className="font-medium">{c.name}</Text>
                  <Text className="font-semibold">{fmt(c.cents)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
      <Text className="text-xs uppercase text-slate-500">{label}</Text>
      <Text className="mt-1 text-lg font-bold">{value}</Text>
    </View>
  );
}
