import { useEffect } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";
import { useActiveMerchant } from "@/lib/useActiveMerchant";

interface OrderItem {
  name_snapshot: string;
  quantity: number;
}
interface KdsOrder {
  id: string;
  number: number;
  source: string;
  status: "received" | "preparing" | "ready";
  created_at: string;
  order_items: OrderItem[];
}

const NEXT_STATUS: Record<string, string> = {
  received: "preparing",
  preparing: "ready",
  ready: "completed", // leaves the board
};
const ACTION_LABEL: Record<string, string> = {
  received: "Start",
  preparing: "Mark ready",
  ready: "Complete",
};
const STATUS_BG: Record<string, string> = {
  received: "bg-amber-50 border-amber-200",
  preparing: "bg-blue-50 border-blue-200",
  ready: "bg-emerald-50 border-emerald-200",
};

function age(iso: string) {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Kds() {
  const qc = useQueryClient();
  const { data: merchantId } = useActiveMerchant();

  const { data: orders = [], isLoading } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["kds-orders", merchantId],
    refetchInterval: 15000, // keeps the age timer fresh even without events
    queryFn: async (): Promise<KdsOrder[]> => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("id, number, source, status, created_at, order_items(name_snapshot, quantity)")
        .eq("merchant_id", merchantId)
        .in("status", ["received", "preparing", "ready"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as KdsOrder[];
    },
  });

  // Realtime: new orders / status changes push instantly to the board.
  useEffect(() => {
    if (!merchantId) return;
    const channel = supabase
      .channel(`kds:${merchantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `merchant_id=eq.${merchantId}` },
        () => qc.invalidateQueries({ queryKey: ["kds-orders", merchantId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantId, qc]);

  const advance = useMutation({
    mutationFn: async (order: KdsOrder) => {
      const next = NEXT_STATUS[order.status];
      const { error } = await (supabase as any)
        .from("orders")
        .update({ status: next })
        .eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kds-orders", merchantId] }),
  });

  return (
    <ScreenContainer>
      <View className="flex-1 p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold tracking-tight">Kitchen Display</Text>
          <Text className="text-sm text-slate-500">{orders.length} active</Text>
        </View>

        {isLoading ? <ActivityIndicator className="mt-8" /> : null}

        <FlatList
          className="mt-4"
          data={orders}
          numColumns={3}
          keyExtractor={(o) => o.id}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ gap: 12 }}
          ListEmptyComponent={
            !isLoading ? (
              <Text className="mt-12 text-center text-slate-400">
                No active orders. New POS/Kiosk orders appear here instantly.
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Card className={`flex-1 border ${STATUS_BG[item.status] ?? ""}`}>
              <View className="flex-row items-center justify-between">
                <Text className="text-3xl font-bold">#{item.number}</Text>
                <View className="items-end">
                  <Text className="text-xs uppercase text-slate-500">{item.source}</Text>
                  <Text className="text-sm text-slate-500">{age(item.created_at)}</Text>
                </View>
              </View>
              <View className="mt-3 gap-1">
                {item.order_items?.map((li, i) => (
                  <Text key={i} className="text-base">
                    {li.quantity} × {li.name_snapshot}
                  </Text>
                ))}
              </View>
              <Pressable
                disabled={advance.isPending}
                onPress={() => advance.mutate(item)}
                className="mt-4 items-center rounded-xl bg-slate-900 py-3 active:opacity-90"
              >
                <Text className="font-semibold text-white">{ACTION_LABEL[item.status]}</Text>
              </Pressable>
            </Card>
          )}
        />
      </View>
    </ScreenContainer>
  );
}
