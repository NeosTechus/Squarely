import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Card, ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import { OrderRow } from "@/components/OrderRow";

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
const OPEN = ["pending", "received", "preparing", "ready"];

interface OrderRow {
  id: string;
  number: number;
  status: string;
  total_cents: number;
  payment_status: string;
  source: string;
  created_at: string;
}

export default function Admin() {
  const { data: merchantId } = useActiveMerchant();

  const { data: orders = [], isLoading, refetch, isRefetching } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["admin-orders", merchantId],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("id, number, status, total_cents, payment_status, source, created_at")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = orders.filter(
    (o) => o.status !== "cancelled" && new Date(o.created_at) >= startOfToday,
  );
  const revenue = today.reduce((s, o) => s + o.total_cents, 0);
  const count = today.length;
  const avg = count ? Math.round(revenue / count) : 0;
  const open = orders.filter((o) => OPEN.includes(o.status)).length;

  const stats = [
    { label: "Today's revenue", value: fmt(revenue) },
    { label: "Orders today", value: String(count) },
    { label: "Avg ticket", value: fmt(avg) },
    { label: "Open tickets", value: String(open) },
  ];

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: 24 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <Text className="text-3xl font-bold tracking-tight">Admin</Text>
        <Text className="mt-2 text-slate-600">
          Today at a glance. Full back-office lives in the web admin.
        </Text>

        {/* analytics */}
        <View className="mt-6 flex-row flex-wrap gap-3">
          {stats.map((s) => (
            <Card key={s.label} className="min-w-[140px] flex-1">
              <Text className="text-xs uppercase tracking-wide text-slate-500">{s.label}</Text>
              <Text className="mt-1 text-xl font-bold">{isLoading ? "…" : s.value}</Text>
            </Card>
          ))}
        </View>

        {/* order history */}
        <Text className="mb-3 mt-8 text-lg font-bold">Order history</Text>
        {isLoading ? (
          <ActivityIndicator className="mt-4" />
        ) : orders.length === 0 ? (
          <Text className="mt-4 text-slate-400">No orders yet.</Text>
        ) : (
          <View className="gap-2">
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
