import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

const fmt = (c: number) => `$${(c / 100).toLocaleString()}`;
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

interface Row {
  id: string;
  name: string;
  subscriptions:
    | { status: string; plans: { tier: string; monthly_price_cents: number } | { tier: string; monthly_price_cents: number }[] | null }[]
    | null;
}

const TIERS = ["starter", "growth", "pro", "enterprise"];

export default function PlatformHome() {
  // Mirror of the web Overview (/admin): same query, same derived stats.
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await (supabase as any)
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
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Stat cards — mirrors web */}
        {isLoading ? (
          <ActivityIndicator className="mt-8" />
        ) : (
          <View className="flex-row gap-3">
            <Stat label="Total clients" value={String(totalClients)} />
            <Stat label="Active subs" value={String(activeSubs)} />
            <Stat label="Est. MRR" value={fmt(mrrCents)} />
          </View>
        )}

        {/* Clients by plan — mirrors web */}
        <View className="rounded-2xl border border-slate-200 bg-white p-5">
          <Text className="mb-3 text-sm font-semibold text-slate-700">Clients by plan</Text>
          {isLoading ? (
            <Text className="text-sm text-slate-500">Loading…</Text>
          ) : (
            <View className="flex-row flex-wrap gap-3">
              {TIERS.map((t) => (
                <View key={t} className="rounded-xl border border-slate-200 px-4 py-2">
                  <Text className="text-xs uppercase tracking-wide text-slate-400">{t}</Text>
                  <Text className="text-lg font-bold">{byTier[t] ?? 0}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Pressable
          onPress={() => router.push("/(platform)/clients" as never)}
          className="self-start rounded-lg bg-brand-600 px-4 py-2 active:bg-brand-700"
        >
          <Text className="text-sm font-semibold text-white">Manage clients →</Text>
        </Pressable>
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
