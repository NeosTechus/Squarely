import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import { useBootMode } from "@/store/boot";
import { OrderRow } from "@/components/OrderRow";

const fmt = (c: number) => `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmt2 = (c: number) => `$${(c / 100).toFixed(2)}`;
const OPEN = ["pending", "received", "preparing", "ready"];

type Period = "today" | "week" | "month";
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

interface Line { name_snapshot: string; quantity: number; unit_price_cents: number }
interface OrderRec {
  id: string;
  number: number;
  status: string;
  total_cents: number;
  payment_method: string | null;
  source: string;
  created_at: string;
  order_items: Line[] | null;
}

function rangeStart(p: Period): Date {
  const d = new Date();
  if (p === "today") d.setHours(0, 0, 0, 0);
  else if (p === "week") { d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); }
  else { d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); }
  return d;
}

export default function Admin() {
  const { data: merchantId } = useActiveMerchant();
  const [period, setPeriod] = useState<Period>("today");
  const qc = useQueryClient();
  const clearMode = useBootMode((s) => s.clear);

  const switchMode = () => {
    clearMode();
    router.replace("/(boot)");
  };

  const signOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          clearMode();
          await supabase.auth.signOut();
          qc.clear();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const { data: orders = [], isLoading, refetch, isRefetching } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["admin-orders", merchantId],
    queryFn: async (): Promise<OrderRec[]> => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("id, number, status, total_cents, payment_method, source, created_at, order_items(name_snapshot, quantity, unit_price_cents)")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const v = useMemo(() => {
    const start = rangeStart(period).getTime();
    const inRange = orders.filter((o) => o.status !== "cancelled" && new Date(o.created_at).getTime() >= start);

    const revenue = inRange.reduce((s, o) => s + o.total_cents, 0);
    const count = inRange.length;
    const avg = count ? Math.round(revenue / count) : 0;

    let itemsSold = 0;
    const byItem: Record<string, { name: string; qty: number; cents: number }> = {};
    const pay: Record<string, number> = {};
    for (const o of inRange) {
      pay[o.payment_method ?? "other"] = (pay[o.payment_method ?? "other"] ?? 0) + o.total_cents;
      for (const l of o.order_items ?? []) {
        itemsSold += l.quantity;
        byItem[l.name_snapshot] ??= { name: l.name_snapshot, qty: 0, cents: 0 };
        byItem[l.name_snapshot]!.qty += l.quantity;
        byItem[l.name_snapshot]!.cents += l.unit_price_cents * l.quantity;
      }
    }
    const topItems = Object.values(byItem).sort((a, b) => b.cents - a.cents).slice(0, 5);

    // chart buckets
    const buckets: { label: string; cents: number }[] = [];
    if (period === "today") {
      for (let h = 0; h < 24; h += 3) buckets.push({ label: `${h}`, cents: 0 });
      for (const o of inRange) buckets[Math.floor(new Date(o.created_at).getHours() / 3)]!.cents += o.total_cents;
    } else {
      const days = period === "week" ? 7 : 30;
      const startMidnight = new Date(); startMidnight.setHours(0, 0, 0, 0);
      startMidnight.setDate(startMidnight.getDate() - (days - 1));
      for (let i = 0; i < days; i++) {
        const d = new Date(startMidnight); d.setDate(d.getDate() + i);
        buckets.push({ label: d.toLocaleDateString(undefined, { day: "numeric" }), cents: 0 });
      }
      const base = startMidnight.getTime();
      for (const o of inRange) {
        const idx = Math.floor((new Date(o.created_at).setHours(0, 0, 0, 0) - base) / 864e5);
        if (idx >= 0 && idx < buckets.length) buckets[idx]!.cents += o.total_cents;
      }
    }
    const maxBar = Math.max(1, ...buckets.map((b) => b.cents));
    const open = orders.filter((o) => OPEN.includes(o.status)).length;

    return { revenue, count, avg, itemsSold, topItems, pay, buckets, maxBar, open };
  }, [orders, period]);

  const payEntries = Object.entries(v.pay).sort((a, b) => b[1] - a[1]);
  const payTotal = payEntries.reduce((s, [, c]) => s + c, 0) || 1;
  const periodLabel = period === "today" ? "today" : period === "week" ? "this week" : "this month";

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="text-3xl font-bold tracking-tight">Analytics</Text>
            <Text className="mt-1 text-slate-500">Your store at a glance</Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable onPress={switchMode} className="rounded-lg border border-slate-200 px-3 py-2 active:bg-slate-50">
              <Text className="text-sm text-slate-600">Switch</Text>
            </Pressable>
            <Pressable onPress={signOut} className="rounded-lg border border-red-200 px-3 py-2 active:bg-red-50">
              <Text className="text-sm font-medium text-red-600">Sign out</Text>
            </Pressable>
          </View>
        </View>

        {/* period toggle */}
        <View className="mt-4 flex-row gap-2">
          {PERIODS.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => setPeriod(p.key)}
              className={`flex-1 rounded-lg py-2 ${period === p.key ? "bg-brand-600" : "bg-slate-100"}`}
            >
              <Text className={`text-center text-sm font-semibold ${period === p.key ? "text-white" : "text-slate-600"}`}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {isLoading ? (
          <ActivityIndicator className="mt-10" />
        ) : (
          <>
            {/* stat cards */}
            <View className="mt-4 flex-row flex-wrap gap-3">
              <Stat label="Revenue" value={fmt(v.revenue)} />
              <Stat label="Orders" value={String(v.count)} />
              <Stat label="Avg ticket" value={fmt2(v.avg)} />
              <Stat label="Items sold" value={String(v.itemsSold)} />
            </View>
            {v.open > 0 ? (
              <Text className="mt-2 text-xs text-amber-600">⏳ {v.open} open ticket{v.open === 1 ? "" : "s"} in the kitchen</Text>
            ) : null}

            {/* sales chart */}
            <Card className="mt-5">
              <Text className="mb-3 text-sm font-semibold text-slate-700">Sales {periodLabel}</Text>
              <View className="h-32 flex-row items-end justify-between gap-1">
                {v.buckets.map((b, i) => (
                  <View key={i} className="flex-1 items-center justify-end">
                    <View
                      className="w-full rounded-t bg-brand-500"
                      style={{ height: Math.max(b.cents ? 3 : 0, (b.cents / v.maxBar) * 110) }}
                    />
                    <Text className="mt-1 text-[8px] text-slate-400">{b.label}</Text>
                  </View>
                ))}
              </View>
            </Card>

            {/* top sellers */}
            <Card className="mt-4">
              <Text className="mb-2 text-sm font-semibold text-slate-700">Top sellers</Text>
              {v.topItems.length === 0 ? (
                <Text className="text-sm text-slate-400">No sales {periodLabel}.</Text>
              ) : (
                v.topItems.map((t, i) => (
                  <View key={t.name} className="flex-row items-center justify-between py-1.5">
                    <Text className="flex-1 text-sm text-slate-700" numberOfLines={1}>
                      {i + 1}. {t.name} <Text className="text-slate-400">×{t.qty}</Text>
                    </Text>
                    <Text className="text-sm font-semibold">{fmt2(t.cents)}</Text>
                  </View>
                ))
              )}
            </Card>

            {/* payment mix */}
            {payEntries.length > 0 ? (
              <Card className="mt-4">
                <Text className="mb-2 text-sm font-semibold text-slate-700">Payment mix</Text>
                {payEntries.map(([method, cents]) => (
                  <View key={method} className="mb-2">
                    <View className="flex-row justify-between">
                      <Text className="text-sm capitalize text-slate-600">{method}</Text>
                      <Text className="text-sm font-medium">{fmt2(cents)}</Text>
                    </View>
                    <View className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <View className="h-full rounded-full bg-brand-500" style={{ width: `${(cents / payTotal) * 100}%` }} />
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}

            {/* order history */}
            <Text className="mb-3 mt-7 text-lg font-bold">Order history</Text>
            {orders.length === 0 ? (
              <Text className="text-slate-400">No orders yet.</Text>
            ) : (
              <View className="gap-2">
                {orders.slice(0, 30).map((o) => (
                  <OrderRow key={o.id} order={o} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-[140px] flex-1">
      <Text className="text-xs uppercase tracking-wide text-slate-500">{label}</Text>
      <Text className="mt-1 text-2xl font-bold">{value}</Text>
    </Card>
  );
}
