import { useState } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator, Image, ImageBackground } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import { useMerchantTheme } from "@/lib/useMerchantTheme";
import { useKioskConfig } from "@/lib/useKioskConfig";

interface MenuItem {
  id: string;
  name: string;
  price_cents: number;
  image_url: string | null;
}
interface Line {
  item_id: string;
  name: string;
  price_cents: number;
  qty: number;
}

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function Kiosk() {
  const [step, setStep] = useState<"welcome" | "menu" | "done">("welcome");
  const [lines, setLines] = useState<Line[]>([]);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);

  const { data: merchantId } = useActiveMerchant();
  const brand = useMerchantTheme();
  const kiosk = useKioskConfig();

  const { data: items = [], isLoading } = useQuery({
    enabled: Boolean(merchantId) && step === "menu",
    queryKey: ["kiosk-items", merchantId],
    queryFn: async (): Promise<MenuItem[]> => {
      const { data, error } = await (supabase as any)
        .from("items")
        .select("id, name, price_cents, image_url")
        .eq("merchant_id", merchantId)
        .eq("active", true)
        .eq("pos_only", false)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const subtotal = lines.reduce((s, l) => s + l.price_cents * l.qty, 0);

  const add = (it: MenuItem) =>
    setLines((prev) => {
      const found = prev.find((l) => l.item_id === it.id);
      if (found)
        return prev.map((l) => (l.item_id === it.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { item_id: it.id, name: it.name, price_cents: it.price_cents, qty: 1 }];
    });

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!merchantId) throw new Error("No active merchant.");
      if (lines.length === 0) throw new Error("Add something first.");
      const { data: num, error: numErr } = await (supabase as any).rpc("next_order_number", {
        p_merchant_id: merchantId,
      });
      if (numErr) throw numErr;
      const { data: order, error: orderErr } = await (supabase as any)
        .from("orders")
        .insert({
          merchant_id: merchantId,
          number: num as number,
          source: "kiosk",
          order_type: "take_out",
          status: "received", // goes to the kitchen (KDS)
          subtotal_cents: subtotal,
          total_cents: subtotal,
          payment_status: "unpaid", // pay at counter
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
          unit_price_cents: l.price_cents,
          quantity: l.qty,
        })),
      );
      if (itemsErr) throw itemsErr;
      return created.number;
    },
    onSuccess: (number) => {
      setOrderNumber(number);
      setLines([]);
      setStep("done");
    },
  });

  // ---- WELCOME ----
  if (step === "welcome") {
    return (
      <ScreenContainer>
        <Pressable
          className="flex-1 active:opacity-95"
          style={{ backgroundColor: brand }}
          onPress={() => setStep("menu")}
        >
          {kiosk.imageUrl ? (
            <ImageBackground source={{ uri: kiosk.imageUrl }} resizeMode="cover" className="flex-1">
              <View className="flex-1 items-center justify-center bg-black/40">
                <Text className="text-6xl font-bold text-white">{kiosk.headline}</Text>
                <Text className="mt-4 text-2xl text-white">{kiosk.subtext}</Text>
              </View>
            </ImageBackground>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-6xl font-bold text-white">{kiosk.headline}</Text>
              <Text className="mt-4 text-2xl text-brand-50">{kiosk.subtext}</Text>
            </View>
          )}
        </Pressable>
      </ScreenContainer>
    );
  }

  // ---- CONFIRMATION ----
  if (step === "done") {
    return (
      <ScreenContainer>
        <Pressable
          className="flex-1 items-center justify-center bg-emerald-600 active:opacity-95"
          onPress={() => {
            setOrderNumber(null);
            setStep("welcome");
          }}
        >
          <Text className="text-5xl font-bold text-white">Thank you! 🎉</Text>
          <Text className="mt-4 text-3xl text-emerald-50">Order #{orderNumber}</Text>
          <Text className="mt-2 text-xl text-emerald-100">Please pay at the counter</Text>
          <Text className="mt-12 text-base text-emerald-200">Tap anywhere for a new order</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  // ---- MENU ----
  return (
    <ScreenContainer>
      <View className="flex-1 flex-row">
        <View className="flex-1 p-4">
          <Text className="mb-3 text-2xl font-bold">Menu</Text>
          {isLoading ? <ActivityIndicator className="mt-8" /> : null}
          <FlatList
            data={items}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ gap: 12 }}
            ListEmptyComponent={
              !isLoading ? (
                <Text className="mt-8 text-center text-slate-400">No items available.</Text>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => add(item)}
                className="flex-1 rounded-2xl border border-slate-200 bg-white p-6 active:bg-slate-50"
              >
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    resizeMode="cover"
                    className="h-24 w-full rounded-xl mb-2"
                  />
                ) : null}
                <Text className="text-lg font-semibold">{item.name}</Text>
                <Text className="mt-1 text-base text-slate-500">{fmt(item.price_cents)}</Text>
              </Pressable>
            )}
          />
        </View>
        <View className="w-96 border-l border-slate-200 bg-white p-4">
          <Text className="text-2xl font-bold">Your order</Text>
          <FlatList
            className="mt-3 flex-1"
            data={lines}
            keyExtractor={(l) => l.item_id}
            ListEmptyComponent={
              <Text className="mt-8 text-center text-slate-400">Tap items to add</Text>
            }
            renderItem={({ item }) => (
              <View className="mb-2 flex-row items-center justify-between rounded-xl bg-slate-50 p-3">
                <Text className="font-semibold">
                  {item.qty} × {item.name}
                </Text>
                <Text className="text-slate-600">{fmt(item.price_cents * item.qty)}</Text>
              </View>
            )}
          />
          <View className="border-t border-slate-200 pt-3">
            <View className="flex-row justify-between">
              <Text className="text-lg font-semibold">Total</Text>
              <Text className="text-lg font-semibold">{fmt(subtotal)}</Text>
            </View>
            <Pressable
              disabled={lines.length === 0 || placeOrder.isPending}
              onPress={() => placeOrder.mutate()}
              className="mt-4 items-center rounded-2xl py-4 active:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: brand }}
            >
              <Text className="text-lg font-bold text-white">
                {placeOrder.isPending ? "Placing…" : "Place order"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setLines([]);
                setStep("welcome");
              }}
              className="mt-2 items-center py-2"
            >
              <Text className="text-slate-500">Cancel</Text>
            </Pressable>
            {placeOrder.isError ? (
              <Text className="mt-2 text-center text-red-600">
                {(placeOrder.error as Error).message}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
