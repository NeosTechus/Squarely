import { useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

interface Row {
  id: string;
  name: string;
  slug: string;
  email: string;
  city: string | null;
  suspended: boolean;
  subscriptions: { plans: { display_name: string } | { display_name: string }[] | null }[] | null;
}

export default function PlatformClients() {
  const [search, setSearch] = useState("");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["platform-clients"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await (supabase as any)
        .from("merchants")
        .select("id, name, slug, email, city, suspended, subscriptions(plans(display_name))")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q),
    );
  }, [clients, search]);

  return (
    <ScreenContainer>
      <View className="flex-1 p-4">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search clients…"
          autoCapitalize="none"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
        <Pressable
          onPress={() => router.push("/(platform)/new-client" as never)}
          className="mt-2 rounded-lg bg-brand-600 px-3 py-2.5 active:bg-brand-700"
        >
          <Text className="text-center text-sm font-semibold text-white">+ New client</Text>
        </Pressable>

        {isLoading ? <ActivityIndicator className="mt-8" /> : null}
        <FlatList
          className="mt-3"
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ gap: 10 }}
          renderItem={({ item }) => {
            const plan = one<{ display_name: string }>(one<{ plans: any }>(item.subscriptions)?.plans ?? null);
            return (
              <Pressable
                onPress={() => router.push(`/(platform)/client?id=${item.id}` as never)}
                className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50"
              >
                <View className="flex-1">
                  <Text className="text-base font-semibold">{item.name}</Text>
                  <Text className="text-xs text-slate-400">
                    {plan?.display_name ?? "No plan"} · {item.city ?? "—"}
                  </Text>
                </View>
                {item.suspended ? (
                  <Text className="mr-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">suspended</Text>
                ) : null}
                <Text className="text-2xl text-slate-300">›</Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={!isLoading ? <Text className="mt-8 text-center text-slate-400">No clients.</Text> : null}
        />
      </View>
    </ScreenContainer>
  );
}
