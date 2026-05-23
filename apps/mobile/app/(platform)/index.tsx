import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

const fmt = (c: number) => `$${(c / 100).toLocaleString()}`;
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export default function PlatformHome() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["platform-home-stats"],
    queryFn: async () => {
      const [{ data: merchants }, { data: subs }] = await Promise.all([
        (supabase as any).from("merchants").select("id"),
        (supabase as any).from("subscriptions").select("status, plans(monthly_price_cents)").eq("status", "active"),
      ]);
      const mrr = (subs ?? []).reduce((s: number, r: any) => {
        const p = one<{ monthly_price_cents: number }>(r.plans);
        return s + (p?.monthly_price_cents ?? 0);
      }, 0);
      return { clients: merchants?.length ?? 0, activeSubs: subs?.length ?? 0, mrr };
    },
  });

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  const tiles = [
    { label: "Clients", body: "View & manage every store, toggle features.", emoji: "🏪", href: "/(platform)/clients" },
    { label: "Analytics", body: "Sales, orders & MRR by day, week, month, year.", emoji: "📈", href: "/(platform)/analytics" },
    { label: "Revenue & health", body: "MRR, ARR, churn and at-risk clients.", emoji: "💰", href: "/(platform)/revenue" },
  ];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-bold tracking-tight">Platform Admin</Text>
            <Text className="mt-1 text-slate-500">Squarely · all clients</Text>
          </View>
          <Pressable onPress={signOut} className="rounded-lg border border-slate-200 px-3 py-2">
            <Text className="text-sm text-slate-600">Sign out</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator className="mt-8" />
        ) : (
          <View className="mt-6 flex-row gap-3">
            <Stat label="Clients" value={String(stats?.clients ?? 0)} />
            <Stat label="Active subs" value={String(stats?.activeSubs ?? 0)} />
            <Stat label="MRR" value={fmt(stats?.mrr ?? 0)} />
          </View>
        )}

        <View className="mt-8 gap-4">
          {tiles.map((t) => (
            <Pressable
              key={t.href}
              onPress={() => router.push(t.href as never)}
              className="flex-row items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 active:bg-slate-50"
            >
              <Text className="text-4xl">{t.emoji}</Text>
              <View className="flex-1">
                <Text className="text-lg font-semibold">{t.label}</Text>
                <Text className="mt-1 text-sm text-slate-600">{t.body}</Text>
              </View>
              <Text className="text-2xl text-slate-300">›</Text>
            </Pressable>
          ))}
        </View>
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
