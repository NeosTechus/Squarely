import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert, Image, Modal } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getGatewayPlugin } from "@squarely/payments";
import { Button, ScreenContainer, Card } from "@squarely/ui-mobile";
import { useCart } from "@/store/cart";
import { supabase } from "@/lib/supabase";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import { useMerchantTheme } from "@/lib/useMerchantTheme";
import { usePaymentGateways } from "@/lib/usePaymentGateways";
import { OrderRow } from "@/components/OrderRow";

/** Map a gateway provider id -> the orders.payment_method enum. */
function providerToPaymentMethod(provider: string): "card" | "cash" | "split" | "other" {
  if (provider === "cash") return "cash";
  if (provider === "valor" || provider === "stripe" || provider === "square") return "card";
  return "other";
}

interface MenuItem {
  id: string;
  name: string;
  price_cents: number;
  image_url: string | null;
}

export default function Pos() {
  const cart = useCart();
  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

  const { data: merchantId } = useActiveMerchant();
  const brand = useMerchantTheme();

  const { data: gateways = [] } = usePaymentGateways();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showOrders, setShowOrders] = useState(false);

  // Recent orders + today's analytics for the POS top strip.
  const { data: orders = [], refetch: refetchOrders } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["pos-orders", merchantId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("id, number, status, total_cents, source, created_at")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as { id: string; number: number; status: string; total_cents: number; source: string; created_at: string }[];
    },
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todays = orders.filter((o) => o.status !== "cancelled" && new Date(o.created_at) >= startOfToday);
  const todayRevenue = todays.reduce((s, o) => s + o.total_cents, 0);
  const todayCount = todays.length;
  const todayAvg = todayCount ? Math.round(todayRevenue / todayCount) : 0;

  // Pre-select the default (first) gateway once they load.
  useEffect(() => {
    if (!selectedProvider && gateways[0]) {
      setSelectedProvider(gateways[0].provider);
    }
  }, [gateways, selectedProvider]);

  const {
    data: items = [],
    isLoading,
    error,
  } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["pos-items", merchantId],
    queryFn: async (): Promise<MenuItem[]> => {
      const { data, error } = await (supabase as any)
        .from("items")
        .select("id, name, price_cents, image_url")
        .eq("merchant_id", merchantId)
        .eq("active", true)
        .eq("kiosk_only", false)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const charge = useMutation({
    mutationFn: async () => {
      if (!merchantId) throw new Error("No active merchant.");
      const lines = cart.lines;
      if (lines.length === 0) throw new Error("Cart is empty.");
      const provider = selectedProvider ?? gateways[0]?.provider ?? "cash";
      if (!provider) throw new Error("No payment gateway selected.");
      const subtotal = cart.subtotalCents();

      const paymentMethod = providerToPaymentMethod(provider);
      // Manual gateways (cash) settle at the counter, so mark paid immediately.
      // Card gateways (valor/stripe/square) are also marked paid for now since we
      // don't have processor credentials yet — we record the sale without contacting
      // the processor.
      // TODO: real card capture via PaymentProvider adapter
      const paymentStatus = "paid";

      const { data: num, error: numErr } = await (supabase as any).rpc("next_order_number", {
        p_merchant_id: merchantId,
      });
      if (numErr) throw numErr;

      const { data: order, error: orderErr } = await (supabase as any)
        .from("orders")
        .insert({
          merchant_id: merchantId,
          number: num as number,
          source: "pos",
          order_type: "take_out",
          status: "completed",
          subtotal_cents: subtotal,
          total_cents: subtotal,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
        })
        .select("id, number")
        .single();
      if (orderErr) throw orderErr;
      const created = order as { id: string; number: number };

      const { error: itemsErr } = await (supabase as any).from("order_items").insert(
        lines.map((l) => ({
          order_id: created.id,
          item_id: l.item_id,
          name_snapshot: l.name,
          unit_price_cents: l.unit_price_cents,
          quantity: l.quantity,
        })),
      );
      if (itemsErr) throw itemsErr;
      return created;
    },
    onSuccess: (order) => {
      Alert.alert("Order complete", `Order #${order.number} charged.`);
      cart.clear();
      refetchOrders();
    },
    onError: (e) => Alert.alert("Charge failed", (e as Error).message),
  });

  return (
    <ScreenContainer>
      <View className="flex-1 flex-row">
        <View className="flex-1 p-4">
          {/* top analytics + orders strip */}
          <View className="mb-3 flex-row items-center gap-2">
            <Stat label="Today" value={fmt(todayRevenue)} />
            <Stat label="Orders" value={String(todayCount)} />
            <Stat label="Avg" value={fmt(todayAvg)} />
            <Pressable
              onPress={() => { refetchOrders(); setShowOrders(true); }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 active:bg-slate-50"
            >
              <Text className="text-xs uppercase tracking-wide text-slate-500">History</Text>
              <Text className="mt-1 text-sm font-bold text-brand-600">Orders ›</Text>
            </Pressable>
          </View>
          <Text className="mb-3 text-xl font-bold">Menu</Text>
          {isLoading ? <ActivityIndicator className="mt-8" /> : null}
          {error ? (
            <Text className="mt-8 text-center text-red-600">
              Couldn't load menu: {(error as Error).message}
            </Text>
          ) : null}
          <FlatList
            data={items}
            numColumns={4}
            className="flex-1"
            columnWrapperStyle={{ gap: 8 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              !isLoading && !error ? (
                <Text className="mt-8 text-center text-slate-400">
                  No items yet. Add them in the web dashboard.
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  cart.addLine({
                    id: `${item.id}-${Date.now()}`,
                    item_id: item.id,
                    name: item.name,
                    unit_price_cents: item.price_cents,
                    quantity: 1,
                    modifiers: [],
                  })
                }
                className="flex-1 rounded-xl border border-slate-200 bg-white p-2 active:bg-slate-50"
              >
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    resizeMode="cover"
                    className="h-14 w-full rounded-lg mb-1.5"
                  />
                ) : null}
                <Text className="text-xs font-semibold" numberOfLines={1}>{item.name}</Text>
                <Text className="text-xs text-slate-500">{fmt(item.price_cents)}</Text>
              </Pressable>
            )}
          />
        </View>
        <View className="w-80 border-l border-slate-200 bg-white p-4">
          <Text className="text-xl font-bold">Cart</Text>
          <FlatList
            className="mt-3 flex-1"
            data={cart.lines}
            keyExtractor={(l) => l.id}
            renderItem={({ item }) => (
              <Card className="mb-2 flex-row items-center justify-between">
                <View>
                  <Text className="font-semibold">{item.name}</Text>
                  <Text className="text-sm text-slate-500">
                    {item.quantity} × {fmt(item.unit_price_cents)}
                  </Text>
                </View>
                <Pressable onPress={() => cart.removeLine(item.id)}>
                  <Text className="text-red-600">Remove</Text>
                </Pressable>
              </Card>
            )}
            ListEmptyComponent={
              <Text className="mt-8 text-center text-slate-400">Tap items to add</Text>
            }
          />
          <View className="border-t border-slate-200 pt-3">
            <View className="flex-row justify-between">
              <Text className="font-semibold">Subtotal</Text>
              <Text className="font-semibold">{fmt(cart.subtotalCents())}</Text>
            </View>
            {gateways.length > 0 ? (
              <View className="mt-3">
                <Text className="mb-2 text-sm font-semibold text-slate-500">Payment</Text>
                <View className="flex-row flex-wrap gap-2">
                  {gateways.map((g) => {
                    const selected = g.provider === selectedProvider;
                    const label = getGatewayPlugin(g.provider)?.label ?? g.provider;
                    return (
                      <Pressable
                        key={g.provider}
                        onPress={() => setSelectedProvider(g.provider)}
                        className="rounded-full border px-4 py-2"
                        style={{
                          backgroundColor: selected ? brand : "#ffffff",
                          borderColor: selected ? brand : "#e2e8f0",
                        }}
                      >
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: selected ? "#ffffff" : "#475569" }}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <Button
              label={charge.isPending ? "Charging…" : "Charge"}
              size="lg"
              className="mt-4"
              style={{ backgroundColor: brand }}
              disabled={cart.lines.length === 0 || charge.isPending || !selectedProvider}
              onPress={() => charge.mutate()}
            />
            <Button
              label="Clear"
              variant="ghost"
              className="mt-2"
              onPress={cart.clear}
            />
          </View>
        </View>
      </View>

      {/* Order history modal */}
      <Modal visible={showOrders} animationType="slide" transparent onRequestClose={() => setShowOrders(false)}>
        <Pressable onPress={() => setShowOrders(false)} className="flex-1 bg-slate-900/40" />
        <View className="absolute bottom-0 left-0 right-0 max-h-[75%] rounded-t-3xl bg-white">
          <View className="flex-row items-center justify-between border-b border-slate-100 px-5 py-4">
            <Text className="text-lg font-bold">Order history</Text>
            <Pressable onPress={() => setShowOrders(false)} hitSlop={8}>
              <Text className="text-sm font-medium text-brand-600">Close</Text>
            </Pressable>
          </View>
          <FlatList
            data={orders}
            keyExtractor={(o) => o.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => <OrderRow order={item} />}
            ListEmptyComponent={<Text className="mt-8 text-center text-slate-400">No orders yet.</Text>}
          />
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <Text className="text-xs uppercase tracking-wide text-slate-500">{label}</Text>
      <Text className="mt-1 text-sm font-bold" numberOfLines={1}>{value}</Text>
    </View>
  );
}
