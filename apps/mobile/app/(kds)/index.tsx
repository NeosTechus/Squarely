import { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, useWindowDimensions } from "react-native";
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

function age(iso: string, nowMs: number) {
  const secs = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Whole minutes since the order was created, used for the age badge + SLA escalation.
function ageMinutes(iso: string, nowMs: number) {
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60000));
}

const SLA_WARN_MIN = 5; // amber threshold
const SLA_LATE_MIN = 10; // red threshold

// Age-based escalation: <5m green, 5-10m amber, >10m red.
function ageTier(minutes: number) {
  if (minutes > SLA_LATE_MIN) return "late" as const;
  if (minutes >= SLA_WARN_MIN) return "warn" as const;
  return "ok" as const;
}

const AGE_BORDER: Record<"ok" | "warn" | "late", string> = {
  ok: "border-l-4 border-l-emerald-400",
  warn: "border-l-4 border-l-amber-400",
  late: "border-l-4 border-l-red-500",
};
const AGE_BADGE: Record<"ok" | "warn" | "late", string> = {
  ok: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-800",
  late: "bg-red-100 text-red-700",
};

export default function Kds() {
  const qc = useQueryClient();
  const { data: merchantId } = useActiveMerchant();

  // Tablet shows a 3-up board; phones get 1 column so cards aren't cramped.
  const { width } = useWindowDimensions();
  const columns = width >= 1000 ? 3 : width >= 640 ? 2 : 1;

  // Tick every 30s so ticket ages escalate live even when no new data arrives.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

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

  // How many tickets have breached the 10-min SLA (drives the header banner).
  const lateCount = useMemo(
    () => orders.filter((o) => ageMinutes(o.created_at, now) > SLA_LATE_MIN).length,
    [orders, now],
  );

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

        {lateCount > 0 ? (
          <View className="mt-3 flex-row items-center rounded-xl border border-red-200 bg-red-50 px-4 py-2">
            <Text className="text-sm font-semibold text-red-700">
              ⚠ {lateCount} {lateCount === 1 ? "ticket" : "tickets"} over {SLA_LATE_MIN} min
            </Text>
          </View>
        ) : null}

        {isLoading ? <ActivityIndicator className="mt-8" /> : null}

        <FlatList
          className="mt-4"
          key={`kds-${columns}`}
          data={orders}
          numColumns={columns}
          keyExtractor={(o) => o.id}
          columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
          contentContainerStyle={{ gap: 12 }}
          ListEmptyComponent={
            !isLoading ? (
              <Text className="mt-12 text-center text-slate-400">
                No active orders. New POS/Kiosk orders appear here instantly.
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const mins = ageMinutes(item.created_at, now);
            const tier = ageTier(mins);
            return (
            <Card className={`flex-1 border ${STATUS_BG[item.status] ?? ""} ${AGE_BORDER[tier]}`}>
              <View className="flex-row items-center justify-between">
                <Text className="text-3xl font-bold">#{item.number}</Text>
                <View className="items-end gap-1">
                  <Text className="text-xs uppercase text-slate-500">{item.source}</Text>
                  <Text className={`rounded-full px-2 py-0.5 text-xs font-semibold ${AGE_BADGE[tier]}`}>
                    {mins}m
                  </Text>
                  <Text className="text-xs text-slate-400">{age(item.created_at, now)}</Text>
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
            );
          }}
        />
      </View>
    </ScreenContainer>
  );
}
