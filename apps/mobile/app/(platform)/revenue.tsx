import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

const fmt = (c: number) => `$${(c / 100).toLocaleString()}`;
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export default function PlatformRevenue() {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-revenue"],
    queryFn: async () => {
      const { data: subs } = await (supabase as any)
        .from("subscriptions")
        .select("status, plans(tier, display_name, monthly_price_cents)");
      let mrr = 0;
      let active = 0;
      let churned = 0;
      const byTier: Record<string, { name: string; count: number; cents: number }> = {};
      for (const s of subs ?? []) {
        const p = one<{ tier: string; display_name: string; monthly_price_cents: number }>(s.plans);
        if (s.status === "active") {
          active += 1;
          if (p) {
            mrr += p.monthly_price_cents;
            byTier[p.tier] ??= { name: p.display_name, count: 0, cents: 0 };
            byTier[p.tier]!.count += 1;
            byTier[p.tier]!.cents += p.monthly_price_cents;
          }
        } else churned += 1;
      }
      return { mrr, arr: mrr * 12, active, churned, tiers: Object.values(byTier) };
    },
  });

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "Revenue & health" }} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {isLoading ? <ActivityIndicator className="mt-8" /> : (
          <>
            <View className="flex-row gap-3">
              <Stat label="MRR" value={fmt(data?.mrr ?? 0)} />
              <Stat label="ARR" value={fmt(data?.arr ?? 0)} />
            </View>
            <View className="mt-3 flex-row gap-3">
              <Stat label="Active subs" value={String(data?.active ?? 0)} />
              <Stat label="Churned" value={String(data?.churned ?? 0)} />
            </View>

            <Text className="mt-6 mb-2 text-sm font-semibold text-slate-700">MRR by plan</Text>
            <View className="rounded-2xl border border-slate-200 bg-white">
              {(data?.tiers ?? []).map((t, i) => (
                <View key={i} className="flex-row justify-between border-b border-slate-50 p-3">
                  <Text className="font-medium">{t.name} <Text className="text-slate-400">×{t.count}</Text></Text>
                  <Text className="font-semibold">{fmt(t.cents)}/mo</Text>
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
      <Text className="mt-1 text-xl font-bold">{value}</Text>
    </View>
  );
}
