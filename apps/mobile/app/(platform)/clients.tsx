import { useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, Switch, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

type FeatureKey = "pos" | "kiosk" | "kds" | "admin";
const FEATURES: FeatureKey[] = ["pos", "kiosk", "kds", "admin"];
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

interface Row {
  id: string;
  name: string;
  city: string | null;
  suspended: boolean;
  merchant_features: Record<FeatureKey, boolean> | null;
  subscriptions: { plans: { display_name: string } | { display_name: string }[] | null }[] | null;
}

export default function PlatformClients() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["platform-clients"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await (supabase as any)
        .from("merchants")
        .select("id, name, city, suspended, merchant_features(pos,kiosk,kds,admin), subscriptions(plans(display_name))")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggle = useMutation({
    mutationFn: async (a: { id: string; key: FeatureKey; value: boolean }) => {
      const { error } = await (supabase as any)
        .from("merchant_features")
        .update({ [a.key]: a.value, updated_at: new Date().toISOString() })
        .eq("merchant_id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-clients"] }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q) || (c.city ?? "").toLowerCase().includes(q));
  }, [clients, search]);

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: "Clients" }} />
      <View className="flex-1 p-4">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search clients…"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        {isLoading ? <ActivityIndicator className="mt-8" /> : null}
        <FlatList
          className="mt-3"
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ gap: 12 }}
          renderItem={({ item }) => {
            const plan = one<{ display_name: string }>(one<{ plans: any }>(item.subscriptions)?.plans ?? null);
            return (
              <View className="rounded-2xl border border-slate-200 bg-white p-4">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-base font-semibold">{item.name}</Text>
                    <Text className="text-xs text-slate-400">
                      {plan?.display_name ?? "No plan"} · {item.city ?? "—"}
                    </Text>
                  </View>
                  {item.suspended ? (
                    <Text className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">suspended</Text>
                  ) : null}
                </View>
                <View className="mt-3 flex-row flex-wrap gap-x-5 gap-y-2">
                  {FEATURES.map((f) => {
                    const on = item.merchant_features?.[f] ?? true;
                    return (
                      <View key={f} className="flex-row items-center gap-2">
                        <Text className="text-sm uppercase text-slate-600">{f}</Text>
                        <Switch
                          value={on}
                          onValueChange={(v) => toggle.mutate({ id: item.id, key: f, value: v })}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={!isLoading ? <Text className="mt-8 text-center text-slate-400">No clients.</Text> : null}
        />
      </View>
    </ScreenContainer>
  );
}
