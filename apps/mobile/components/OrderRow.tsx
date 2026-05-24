import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

export interface OrderSummary {
  id: string;
  number: number;
  status: string;
  total_cents: number;
  source: string;
  created_at: string;
}

interface Line {
  id: string;
  name_snapshot: string;
  quantity: number;
  unit_price_cents: number;
}

const statusClass = (s: string) =>
  s === "completed"
    ? "bg-emerald-50 text-emerald-700"
    : s === "cancelled"
      ? "bg-red-50 text-red-600"
      : "bg-amber-50 text-amber-700";

/** A tappable order row that expands to show its line items + total. */
export function OrderRow({ order }: { order: OrderSummary }) {
  const [open, setOpen] = useState(false);

  const { data: lines = [], isLoading } = useQuery({
    enabled: open,
    queryKey: ["order-items", order.id],
    queryFn: async (): Promise<Line[]> => {
      const { data, error } = await (supabase as any)
        .from("order_items")
        .select("id, name_snapshot, quantity, unit_price_cents")
        .eq("order_id", order.id);
      if (error) throw error;
      return (data ?? []) as Line[];
    },
  });

  return (
    <View className="overflow-hidden rounded-xl border border-slate-100">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        className="flex-row items-center justify-between px-4 py-3 active:bg-slate-50"
      >
        <View className="flex-1">
          <Text className="font-semibold">#{order.number}</Text>
          <Text className="text-xs text-slate-400">
            {new Date(order.created_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · {order.source}
          </Text>
        </View>
        <Text className={`mr-3 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(order.status)}`}>
          {order.status}
        </Text>
        <Text className="w-20 text-right font-semibold">{fmt(order.total_cents)}</Text>
        <Text className="ml-2 text-slate-300">{open ? "▾" : "›"}</Text>
      </Pressable>

      {open ? (
        <View className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          {isLoading ? (
            <ActivityIndicator />
          ) : lines.length === 0 ? (
            <Text className="text-sm text-slate-400">No line items.</Text>
          ) : (
            <>
              {lines.map((l) => (
                <View key={l.id} className="flex-row items-center justify-between py-1">
                  <Text className="flex-1 text-sm text-slate-600">
                    {l.quantity} × {l.name_snapshot}
                  </Text>
                  <Text className="text-sm text-slate-500">{fmt(l.unit_price_cents)}</Text>
                  <Text className="w-20 text-right text-sm font-medium text-slate-700">
                    {fmt(l.unit_price_cents * l.quantity)}
                  </Text>
                </View>
              ))}
              <View className="mt-2 flex-row items-center justify-between border-t border-slate-200 pt-2">
                <Text className="text-sm font-semibold">Total</Text>
                <Text className="text-sm font-bold">{fmt(order.total_cents)}</Text>
              </View>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}
