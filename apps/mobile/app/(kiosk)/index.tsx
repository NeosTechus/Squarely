import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Image, ImageBackground, ScrollView } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ScreenContainer } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import { useMerchantTheme } from "@/lib/useMerchantTheme";
import { useKioskConfig } from "@/lib/useKioskConfig";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  category_id: string | null;
  modifier_group_ids: string[] | null;
}
interface Category {
  id: string;
  name: string;
  image_url: string | null;
}
interface Line {
  item_id: string;
  name: string;
  price_cents: number;
  qty: number;
}
type OrderType = "dine_in" | "take_out";

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function Kiosk() {
  const [step, setStep] = useState<"welcome" | "dining" | "menu" | "review" | "done">("welcome");
  const [orderType, setOrderType] = useState<OrderType>("take_out");
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<{ lines: Line[]; subtotal: number; orderType: OrderType } | null>(null);

  const { data: merchantId } = useActiveMerchant();
  const brand = useMerchantTheme();
  const kiosk = useKioskConfig();

  const active = step === "menu" || step === "review";

  const { data: storeName = "" } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["kiosk-store-name", merchantId],
    queryFn: async (): Promise<string> => {
      const { data } = await (supabase as any).from("merchants").select("name").eq("id", merchantId).single();
      return data?.name ?? "";
    },
  });

  const { data: categories = [] } = useQuery({
    enabled: Boolean(merchantId) && active,
    queryKey: ["kiosk-categories", merchantId],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("id, name, image_url")
        .eq("merchant_id", merchantId)
        .eq("active", true)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: items = [], isLoading } = useQuery({
    enabled: Boolean(merchantId) && active,
    queryKey: ["kiosk-items", merchantId],
    queryFn: async (): Promise<MenuItem[]> => {
      const { data, error } = await (supabase as any)
        .from("items")
        .select("id, name, description, price_cents, image_url, category_id, modifier_group_ids")
        .eq("merchant_id", merchantId)
        .eq("active", true)
        .eq("pos_only", false)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  // category tile fallback image = first item's image in that category
  const catImage = (c: Category) =>
    c.image_url || items.find((i) => i.category_id === c.id && i.image_url)?.image_url || null;

  const searching = search.trim().length > 0;
  const shownItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) return items.filter((i) => i.name.toLowerCase().includes(q));
    if (selectedCat) return items.filter((i) => i.category_id === selectedCat.id);
    return [];
  }, [items, search, selectedCat]);

  const subtotal = lines.reduce((s, l) => s + l.price_cents * l.qty, 0);
  const cartCount = lines.reduce((s, l) => s + l.qty, 0);
  const qtyFor = (id: string) => lines.find((l) => l.item_id === id)?.qty ?? 0;

  const add = (it: MenuItem) =>
    setLines((prev) => {
      const found = prev.find((l) => l.item_id === it.id);
      if (found) return prev.map((l) => (l.item_id === it.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { item_id: it.id, name: it.name, price_cents: it.price_cents, qty: 1 }];
    });
  const dec = (id: string) =>
    setLines((prev) =>
      prev.flatMap((l) => (l.item_id === id ? (l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []) : [l])),
    );

  const resetAll = () => {
    setLines([]);
    setSelectedCat(null);
    setSearch("");
    setStep("welcome");
  };

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!merchantId) throw new Error("No active merchant.");
      if (lines.length === 0) throw new Error("Add something first.");
      const { data: num, error: numErr } = await (supabase as any).rpc("next_order_number", { p_merchant_id: merchantId });
      if (numErr) throw numErr;
      const { data: order, error: orderErr } = await (supabase as any)
        .from("orders")
        .insert({
          merchant_id: merchantId,
          number: num as number,
          source: "kiosk",
          order_type: orderType,
          status: "received",
          subtotal_cents: subtotal,
          total_cents: subtotal,
          payment_status: "unpaid",
        })
        .select("id, number")
        .single();
      if (orderErr) throw orderErr;
      const created = order as { id: string; number: number };
      const { error: itemsErr } = await (supabase as any).from("order_items").insert(
        lines.map((l) => ({ order_id: created.id, item_id: l.item_id, name_snapshot: l.name, unit_price_cents: l.price_cents, quantity: l.qty })),
      );
      if (itemsErr) throw itemsErr;
      return created.number;
    },
    onSuccess: (number) => {
      setReceipt({ lines, subtotal, orderType });
      setOrderNumber(number);
      setLines([]);
      setSelectedCat(null);
      setStep("done");
    },
  });

  // ---- WELCOME ----
  if (step === "welcome") {
    return (
      <ScreenContainer edges={["bottom"]}>
        <Pressable className="flex-1 active:opacity-95" style={{ backgroundColor: brand }} onPress={() => setStep("dining")}>
          {kiosk.imageUrl ? (
            <ImageBackground source={{ uri: kiosk.imageUrl }} resizeMode="cover" className="flex-1">
              <View className="flex-1 items-center justify-center bg-black/40">
                <Text className="px-6 text-center text-6xl font-bold text-white">{kiosk.headline}</Text>
                <Text className="mt-4 text-2xl text-white">{kiosk.subtext}</Text>
              </View>
            </ImageBackground>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="px-6 text-center text-6xl font-bold text-white">{kiosk.headline}</Text>
              <Text className="mt-4 text-2xl text-brand-50">{kiosk.subtext}</Text>
            </View>
          )}
        </Pressable>
      </ScreenContainer>
    );
  }

  // ---- DINING OPTION ----
  if (step === "dining") {
    const Choice = ({ type, emoji, label, desc }: { type: OrderType; emoji: string; label: string; desc: string }) => (
      <Pressable
        onPress={() => { setOrderType(type); setStep("menu"); }}
        className="flex-1 items-center justify-center rounded-3xl border-2 border-slate-200 bg-white p-8 active:bg-slate-50"
      >
        <Text className="text-7xl">{emoji}</Text>
        <Text className="mt-4 text-3xl font-bold text-slate-900">{label}</Text>
        <Text className="mt-1 text-base text-slate-500">{desc}</Text>
      </Pressable>
    );
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-4xl font-bold text-slate-900">How would you like to order?</Text>
          <Text className="mt-2 text-lg text-slate-500">{storeName}</Text>
          <View className="mt-10 w-full max-w-2xl flex-row gap-5" style={{ minHeight: 260 }}>
            <Choice type="dine_in" emoji="🍽️" label="Dine in" desc="Eat here" />
            <Choice type="take_out" emoji="🥡" label="To go" desc="Take away" />
          </View>
          <Pressable onPress={() => setStep("welcome")} className="mt-8 py-2">
            <Text className="text-slate-400">← Back</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  // ---- CONFIRMATION ----
  if (step === "done") {
    return (
      <ScreenContainer>
        <Pressable className="flex-1 items-center justify-center bg-slate-50 active:opacity-95" onPress={resetAll}>
          <View className="w-full max-w-2xl items-center px-6">
            <Text className="text-6xl font-bold" style={{ color: brand }}>Thank you! 🎉</Text>
            <Text className="mt-3 text-4xl font-semibold text-slate-800">Order #{orderNumber}</Text>
            <Text className="mt-1 text-lg text-slate-500">{receipt?.orderType === "dine_in" ? "Dine in" : "To go"}</Text>
            <View className="mt-8 w-full rounded-3xl border border-slate-200 bg-white p-6">
              <Text className="mb-4 text-2xl font-bold text-slate-800">Your receipt</Text>
              <ScrollView className="max-h-72" showsVerticalScrollIndicator>
                {(receipt?.lines ?? []).map((l) => (
                  <View key={l.item_id} className="mb-3 flex-row items-center justify-between">
                    <Text className="flex-1 pr-3 text-xl text-slate-700">{l.qty} × {l.name}</Text>
                    <Text className="text-xl font-medium text-slate-800">{fmt(l.price_cents * l.qty)}</Text>
                  </View>
                ))}
              </ScrollView>
              <View className="mt-2 flex-row justify-between border-t-2 border-slate-200 pt-4">
                <Text className="text-2xl font-bold text-slate-900">Total</Text>
                <Text className="text-2xl font-bold" style={{ color: brand }}>{fmt(receipt?.subtotal ?? 0)}</Text>
              </View>
            </View>
            <Text className="mt-6 text-2xl font-semibold text-slate-700">Please pay at the counter</Text>
            <Pressable onPress={resetAll} className="mt-8 w-full items-center rounded-2xl py-5 active:opacity-90" style={{ backgroundColor: brand }}>
              <Text className="text-2xl font-bold text-white">Start new order</Text>
            </Pressable>
          </View>
        </Pressable>
      </ScreenContainer>
    );
  }

  // ---- TOP BAR (menu + review) ----
  const onBack = () => {
    if (step === "review") { setStep("menu"); return; }
    if (searching) { setSearch(""); return; }
    if (selectedCat) { setSelectedCat(null); return; }
    setStep("dining");
  };
  const backLabel =
    step === "review" ? "Menu" : searching ? "Clear" : selectedCat ? "All Categories" : "Dining Option";

  const TopBar = (
    <View className="flex-row items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
      <Pressable onPress={onBack} className="flex-row items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 active:bg-slate-50">
        <Text className="text-lg text-slate-600">←</Text>
        <Text className="font-medium text-slate-700" numberOfLines={1}>{backLabel}</Text>
      </Pressable>
      <Text className="flex-1 px-2 text-center text-lg font-bold text-slate-900" numberOfLines={1}>{storeName}</Text>
      <Pressable
        onPress={() => setStep("review")}
        disabled={cartCount === 0}
        className="flex-row items-center gap-2 rounded-xl px-4 py-2 active:opacity-90"
        style={{ backgroundColor: cartCount ? brand : "#e2e8f0" }}
      >
        <Text className="text-base">🛍️</Text>
        <Text className="font-bold" style={{ color: cartCount ? "#ffffff" : "#94a3b8" }}>{fmt(subtotal)}</Text>
      </Pressable>
    </View>
  );

  // ---- REVIEW / CART ----
  if (step === "review") {
    return (
      <ScreenContainer edges={["bottom"]}>
        {TopBar}
        <View className="flex-1 p-4">
          <Text className="text-2xl font-bold">Your order · {orderType === "dine_in" ? "Dine in" : "To go"}</Text>
          <FlatList
            className="mt-3 flex-1"
            data={lines}
            keyExtractor={(l) => l.item_id}
            ListEmptyComponent={<Text className="mt-8 text-center text-slate-400">Your cart is empty.</Text>}
            renderItem={({ item }) => (
              <View className="mb-2 flex-row items-center justify-between rounded-xl border border-slate-100 bg-white p-3">
                <Text className="flex-1 pr-2 font-semibold">{item.name}</Text>
                <View className="flex-row items-center gap-3">
                  <Pressable onPress={() => dec(item.item_id)} className="h-9 w-9 items-center justify-center rounded-full bg-slate-100"><Text className="text-xl">−</Text></Pressable>
                  <Text className="w-6 text-center text-lg font-semibold">{item.qty}</Text>
                  <Pressable onPress={() => add({ id: item.item_id, name: item.name, description: null, price_cents: item.price_cents, image_url: null, category_id: null, modifier_group_ids: null })} className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: brand }}><Text className="text-xl text-white">+</Text></Pressable>
                  <Text className="w-20 text-right font-semibold">{fmt(item.price_cents * item.qty)}</Text>
                </View>
              </View>
            )}
          />
          <View className="border-t border-slate-200 pt-3">
            <View className="flex-row justify-between"><Text className="text-xl font-bold">Total</Text><Text className="text-xl font-bold">{fmt(subtotal)}</Text></View>
            <Pressable disabled={lines.length === 0 || placeOrder.isPending} onPress={() => placeOrder.mutate()} className="mt-4 items-center rounded-2xl py-4 active:opacity-90 disabled:opacity-40" style={{ backgroundColor: brand }}>
              <Text className="text-lg font-bold text-white">{placeOrder.isPending ? "Placing…" : "Place order"}</Text>
            </Pressable>
            {placeOrder.isError ? <Text className="mt-2 text-center text-red-600">{(placeOrder.error as Error).message}</Text> : null}
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // horizontal item card (text left, thumbnail right) — matches reference
  const ItemCard = ({ item }: { item: MenuItem }) => {
    const q = qtyFor(item.id);
    const customizable = (item.modifier_group_ids?.length ?? 0) > 0;
    return (
      <View className={`flex-1 rounded-2xl border bg-white p-3 ${q > 0 ? "border-brand-500" : "border-slate-200"}`} style={{ maxWidth: "48.5%" }}>
        <Pressable onPress={() => add(item)} className="flex-row items-center justify-between active:opacity-80">
          <View className="flex-1 pr-3">
            <Text className="text-base font-semibold" numberOfLines={1}>{item.name}</Text>
            {item.description ? (
              <Text className="mt-1 text-xs text-slate-500" numberOfLines={2}>{item.description}</Text>
            ) : null}
            <View className="mt-2 flex-row items-center gap-2">
              <Text className="text-base font-medium text-slate-700">{fmt(item.price_cents)}</Text>
              {customizable ? (
                <Text className="rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">Customizable</Text>
              ) : null}
            </View>
          </View>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} resizeMode="cover" className="h-16 w-16 rounded-xl" />
          ) : null}
        </Pressable>

        {/* add / stepper — remove items right here */}
        <View className="mt-3 flex-row items-center justify-end">
          {q > 0 ? (
            <View className="flex-row items-center gap-3">
              <Pressable onPress={() => dec(item.id)} className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200">
                <Text className="text-xl text-slate-700">−</Text>
              </Pressable>
              <Text className="w-6 text-center text-base font-bold">{q}</Text>
              <Pressable onPress={() => add(item)} className="h-9 w-9 items-center justify-center rounded-full active:opacity-90" style={{ backgroundColor: brand }}>
                <Text className="text-xl text-white">+</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => add(item)} className="rounded-full px-5 py-2 active:opacity-90" style={{ backgroundColor: brand }}>
              <Text className="text-sm font-semibold text-white">Add</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const bannerUri = selectedCat ? catImage(selectedCat) : null;

  // ---- MENU (categories or items) ----
  return (
    <ScreenContainer edges={["bottom"]}>
      {TopBar}

      {!selectedCat && !searching ? (
        /* search + CATEGORY TILES */
        <View className="flex-1 px-4 pt-3">
          <View className="mb-3 flex-row items-center rounded-2xl border border-slate-200 bg-white px-4">
            <Text className="mr-2 text-lg text-slate-400">🔍</Text>
            <TextInput value={search} onChangeText={setSearch} placeholder="Search menu items…" placeholderTextColor="#94a3b8" autoCapitalize="none" className="flex-1 py-3 text-base text-slate-900" />
            {search ? <Pressable onPress={() => setSearch("")} hitSlop={10}><Text className="text-lg text-slate-400">✕</Text></Pressable> : null}
          </View>
          {isLoading ? <ActivityIndicator className="mt-8" /> : null}
          <FlatList
            data={categories}
            numColumns={2}
            key="cats"
            keyExtractor={(c) => c.id}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 100 }}
            ListEmptyComponent={!isLoading ? <Text className="mt-8 text-center text-slate-400">No menu yet.</Text> : null}
            renderItem={({ item }) => {
              const uri = catImage(item);
              return (
                <Pressable onPress={() => setSelectedCat(item)} className="flex-1 overflow-hidden rounded-2xl active:opacity-90" style={{ height: 150, maxWidth: "48.5%" }}>
                  {uri ? (
                    <ImageBackground source={{ uri }} resizeMode="cover" className="flex-1">
                      <View className="flex-1 items-center justify-center bg-black/35">
                        <Text className="text-2xl font-bold text-white">{item.name}</Text>
                      </View>
                    </ImageBackground>
                  ) : (
                    <View className="flex-1 items-center justify-center" style={{ backgroundColor: brand }}>
                      <Text className="text-2xl font-bold text-white">{item.name}</Text>
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      ) : (
        /* category banner + ITEM cards (or search results) */
        <FlatList
          data={shownItems}
          numColumns={2}
          key="items"
          keyExtractor={(i) => i.id}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, gap: 12 }}
          ListHeaderComponent={
            selectedCat && bannerUri ? (
              <View className="-mx-4 mb-3 overflow-hidden">
                <ImageBackground source={{ uri: bannerUri }} resizeMode="cover" style={{ height: 150 }} className="justify-end">
                  <View className="bg-black/25 px-6 py-4">
                    <Text className="text-3xl font-bold text-white">{selectedCat.name}</Text>
                  </View>
                </ImageBackground>
              </View>
            ) : (
              <Text className="mb-3 mt-1 text-lg font-bold text-slate-700">Results for “{search}”</Text>
            )
          }
          ListEmptyComponent={!isLoading ? <Text className="mt-8 text-center text-slate-400">{searching ? `No items match "${search}".` : "No items in this category."}</Text> : null}
          renderItem={({ item }) => <ItemCard item={item} />}
        />
      )}

      {/* floating Review Cart — Pay pill (compact, bottom-right) */}
      {cartCount > 0 ? (
        <Pressable
          onPress={() => setStep("review")}
          className="absolute bottom-5 right-4 flex-row items-center gap-3 rounded-2xl py-3 pl-5 pr-3 shadow-lg active:opacity-90"
          style={{ backgroundColor: brand }}
        >
          <Text className="text-base">🛍️</Text>
          <Text className="text-sm font-bold uppercase tracking-wide text-white">Review cart — Pay</Text>
          <View className="h-7 w-px bg-white/30" />
          <View className="items-end">
            <Text className="text-[9px] uppercase tracking-wide text-white/70">Total</Text>
            <Text className="text-sm font-bold text-white">{fmt(subtotal)}</Text>
          </View>
          <View className="h-6 min-w-[24px] items-center justify-center rounded-full bg-white/25 px-1.5">
            <Text className="text-xs font-bold text-white">{cartCount}</Text>
          </View>
        </Pressable>
      ) : null}
    </ScreenContainer>
  );
}
