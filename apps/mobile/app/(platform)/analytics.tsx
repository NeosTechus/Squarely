import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";

type Period = "today" | "week" | "month" | "year" | "custom";
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const fmt = (c: number) => `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

interface OrderRow {
  total_cents: number;
  status: string;
  created_at: string;
  merchant_id: string;
  merchants: { name: string } | { name: string }[] | null;
}

function ranges(period: Period, from: string, to: string) {
  const now = new Date();
  let startD: Date;
  let end: Date = now;
  if (period === "custom" && from && to) {
    startD = new Date(from + "T00:00:00");
    end = new Date(to + "T23:59:59");
  } else if (period === "today") {
    startD = new Date();
    startD.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    startD = new Date();
    startD.setDate(startD.getDate() - 6);
    startD.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    startD = new Date();
    startD.setDate(startD.getDate() - 29);
    startD.setHours(0, 0, 0, 0);
  } else {
    startD = new Date();
    startD.setMonth(startD.getMonth() - 11);
    startD.setHours(0, 0, 0, 0);
  }
  const len = end.getTime() - startD.getTime();
  return { start: startD, end, prevStart: new Date(startD.getTime() - len), prevEnd: startD };
}

export default function PlatformAnalytics() {
  const [period, setPeriod] = useState<Period>("week");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-analytics-orders"],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("total_cents, status, created_at, merchant_id, merchants(name)")
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const { data: mrrCents = 0 } = useQuery({
    queryKey: ["admin-analytics-mrr"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await (supabase as any)
        .from("subscriptions")
        .select("status, plans(monthly_price_cents)")
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []).reduce((s: number, r: any) => {
        const p = one<{ monthly_price_cents: number }>(r.plans);
        return s + (p?.monthly_price_cents ?? 0);
      }, 0);
    },
  });

  const view = useMemo(() => {
    const { start, end, prevStart, prevEnd } = ranges(period, from, to);
    const inRange = (d: Date, a: Date, b: Date) => d >= a && d <= b;
    const cur = orders.filter((o) => inRange(new Date(o.created_at), start, end));
    const prev = orders.filter((o) => inRange(new Date(o.created_at), prevStart, prevEnd));

    const gmv = cur.reduce((s, o) => s + o.total_cents, 0);
    const prevGmv = prev.reduce((s, o) => s + o.total_cents, 0);
    const count = cur.length;
    const prevCount = prev.length;
    const avg = count ? Math.round(gmv / count) : 0;
    const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100));

    const buckets: { label: string; cents: number }[] = [];
    const hourly = period === "today";
    if (hourly) {
      for (let h = 0; h < 24; h += 3) buckets.push({ label: `${h}:00`, cents: 0 });
      for (const o of cur) buckets[Math.floor(new Date(o.created_at).getHours() / 3)]!.cents += o.total_cents;
    } else {
      const days = Math.min(62, Math.max(1, Math.round((end.getTime() - start.getTime()) / 864e5) + 1));
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        buckets.push({ label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), cents: 0 });
      }
      const startMs = new Date(start).setHours(0, 0, 0, 0);
      for (const o of cur) {
        const idx = Math.floor((new Date(o.created_at).setHours(0, 0, 0, 0) - startMs) / 864e5);
        if (idx >= 0 && idx < buckets.length) buckets[idx]!.cents += o.total_cents;
      }
    }

    const byClient: Record<string, { name: string; cents: number }> = {};
    for (const o of cur) {
      const name = one<{ name: string }>(o.merchants)?.name ?? "Unknown";
      byClient[o.merchant_id] ??= { name, cents: 0 };
      byClient[o.merchant_id]!.cents += o.total_cents;
    }
    const top = Object.values(byClient).sort((a, b) => b.cents - a.cents).slice(0, 5);
    const best = [...buckets].sort((a, b) => b.cents - a.cents)[0];

    return { gmv, count, avg, gmvDelta: delta(gmv, prevGmv), countDelta: delta(count, prevCount), buckets, top, best };
  }, [orders, period, from, to]);

  const maxBar = Math.max(1, ...view.buckets.map((b) => b.cents));
  const label = period === "custom" ? "range" : period;

  return (
    <ScreenContainer edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* period toggle */}
        <View className="flex-row gap-2">
          {PERIODS.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => setPeriod(p.key)}
              className={`rounded-lg px-3 py-2 ${period === p.key ? "bg-brand-600" : "bg-slate-100"}`}
            >
              <Text className={`text-sm font-medium ${period === p.key ? "text-white" : "text-slate-600"}`}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* custom range */}
        <View className="flex-row items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <TextInput
            value={from}
            onChangeText={(v) => {
              setFrom(v);
              if (v && to) setPeriod("custom");
            }}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            className="flex-1 text-sm text-slate-700"
          />
          <Text className="text-slate-400">→</Text>
          <TextInput
            value={to}
            onChangeText={(v) => {
              setTo(v);
              if (from && v) setPeriod("custom");
            }}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            className="flex-1 text-sm text-slate-700"
          />
        </View>

        {isLoading ? (
          <ActivityIndicator className="mt-8" />
        ) : (
          <>
            {/* stat cards */}
            <View className="flex-row flex-wrap gap-3">
              <Stat label="Client sales (GMV)" value={fmt(view.gmv)} delta={view.gmvDelta} />
              <Stat label="Orders" value={String(view.count)} delta={view.countDelta} />
              <Stat label="Avg ticket" value={fmt(view.avg)} />
              <Stat label="Platform MRR" value={fmt(mrrCents)} hint="active subscriptions" />
            </View>

            {/* insights */}
            <View className="rounded-2xl border border-slate-200 bg-white p-5">
              <Text className="mb-2 text-sm font-semibold text-slate-700">Insights</Text>
              <Text className="mb-1 text-sm text-slate-600">
                {view.gmvDelta >= 0 ? "📈" : "📉"} Sales are{" "}
                <Text className={view.gmvDelta >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                  {view.gmvDelta >= 0 ? "up" : "down"} {Math.abs(view.gmvDelta)}%
                </Text>{" "}
                vs the previous {label}.
              </Text>
              {view.best && view.best.cents > 0 ? (
                <Text className="mb-1 text-sm text-slate-600">
                  🏅 Best {period === "today" ? "time" : "day"}: <Text className="font-semibold">{view.best.label}</Text> ({fmt(view.best.cents)}).
                </Text>
              ) : null}
              {view.top[0] ? (
                <Text className="mb-1 text-sm text-slate-600">
                  👑 Top client: <Text className="font-semibold">{view.top[0].name}</Text> ({fmt(view.top[0].cents)}).
                </Text>
              ) : null}
              <Text className="text-sm text-slate-600">
                🧾 Avg ticket this {label}: <Text className="font-semibold">{fmt(view.avg)}</Text>.
              </Text>
            </View>

            {/* sales bar chart */}
            <View className="rounded-2xl border border-slate-200 bg-white p-5">
              <Text className="mb-4 text-sm font-semibold text-slate-700">Sales over {label}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="h-44 flex-row items-end gap-1">
                  {view.buckets.map((b, i) => (
                    <View key={i} className="items-center justify-end" style={{ minWidth: 20 }}>
                      <View
                        className="w-4 rounded-t bg-brand-500"
                        style={{ height: Math.max(b.cents ? 4 : 0, (b.cents / maxBar) * 150) }}
                      />
                      <Text className="mt-1 text-[8px] text-slate-500">{b.label}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* top clients */}
            <View className="rounded-2xl border border-slate-200 bg-white p-5">
              <Text className="mb-3 text-sm font-semibold text-slate-700">Top clients ({label})</Text>
              {view.top.length === 0 ? (
                <Text className="text-sm text-slate-500">No sales in this period.</Text>
              ) : (
                view.top.map((c, i) => (
                  <View key={i} className="flex-row justify-between border-b border-slate-50 py-2">
                    <Text className="font-medium text-slate-700">{c.name}</Text>
                    <Text className="font-semibold">{fmt(c.cents)}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function Stat({ label, value, hint, delta }: { label: string; value: string; hint?: string; delta?: number }) {
  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-4" style={{ width: "47%", flexGrow: 1 }}>
      <Text className="text-xs uppercase tracking-wide text-slate-500">{label}</Text>
      <Text className="mt-1 text-2xl font-bold">{value}</Text>
      {delta !== undefined ? (
        <Text className={`text-xs font-medium ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs prev
        </Text>
      ) : hint ? (
        <Text className="text-xs text-slate-400">{hint}</Text>
      ) : null}
    </View>
  );
}
