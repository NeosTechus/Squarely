import { useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, Alert, Image, Modal, ScrollView, useWindowDimensions } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button, ScreenContainer, Card } from "@squarely/ui-mobile";
import { useCart } from "@/store/cart";
import { supabase } from "@/lib/supabase";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import { useMerchantTheme } from "@/lib/useMerchantTheme";
import { chargeOnTerminal } from "@/lib/terminalCharge";
import { useMerchantTax } from "@/lib/useMerchantTax";
import { OrderRow } from "@/components/OrderRow";
import { Receipt, type ReceiptData } from "@/components/Receipt";
import { ModifierSheet, type SelectedModifier } from "@/components/ModifierSheet";

interface MenuItem {
  id: string;
  name: string;
  price_cents: number;
  image_url: string | null;
  modifier_group_ids: string[] | null;
}

export default function Pos() {
  const cart = useCart();
  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

  // Tablet / landscape → side-by-side; narrow phone → stacked.
  const { width } = useWindowDimensions();
  const wide = width >= 700;

  const { data: merchantId } = useActiveMerchant();
  const brand = useMerchantTheme();
  const tax = useMerchantTax();

  // Store name for the printed receipt header.
  const { data: storeName = "Receipt" } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["merchant-name", merchantId],
    queryFn: async (): Promise<string> => {
      const { data, error } = await (supabase as any)
        .from("merchants")
        .select("name")
        .eq("id", merchantId)
        .single();
      if (error) throw error;
      return (data?.name as string) ?? "Receipt";
    },
  });

  const [showOrders, setShowOrders] = useState(false);
  const [showOpen, setShowOpen] = useState(false);

  // Modifier picker: opened when adding an item that has modifier groups.
  const [modItem, setModItem] = useState<MenuItem | null>(null);
  const [showMods, setShowMods] = useState(false);

  // Tip on a new sale: preset % of subtotal or a custom dollar amount.
  const [tipCents, setTipCents] = useState(0);
  const [customTip, setCustomTip] = useState("");

  // Receipt shown after a completed charge (snapshotted before the cart clears).
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // Payment: cash / card / split. For split, the cashier enters the cash part.
  type PayType = "cash" | "card" | "split";
  const [payType, setPayType] = useState<PayType>("cash");
  const [splitCash, setSplitCash] = useState("");

  // When settling a "pay at counter" order placed from the kiosk.
  const [settling, setSettling] = useState<{ id: string; number: number } | null>(null);

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

  // Open ("pay at counter") orders awaiting checkout — e.g. placed at the kiosk.
  const { data: openOrders = [], refetch: refetchOpen } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["pos-open-orders", merchantId],
    queryFn: async () => {
      // Auto-expire stale unpaid counter orders (older than 1 hour) so they
      // don't pile up in the queue.
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      await (supabase as any)
        .from("orders")
        .update({ status: "cancelled" })
        .eq("merchant_id", merchantId)
        .eq("payment_status", "unpaid")
        .neq("status", "cancelled")
        .lt("created_at", cutoff);

      const { data, error } = await (supabase as any)
        .from("orders")
        .select("id, number, order_type, total_cents, source, created_at, order_items(id, item_id, name_snapshot, unit_price_cents, quantity)")
        .eq("merchant_id", merchantId)
        .eq("payment_status", "unpaid")
        .neq("status", "cancelled")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; number: number; order_type: string; total_cents: number; source: string; created_at: string;
        order_items: Array<{ id: string; item_id: string; name_snapshot: string; unit_price_cents: number; quantity: number }>;
      }>;
    },
  });

  // Load an open order's items into the cart to collect payment for it.
  const loadOpenOrder = (o: (typeof openOrders)[number]) => {
    cart.clear();
    for (const li of o.order_items ?? []) {
      cart.addLine({
        id: `${li.item_id}-${li.id}`,
        item_id: li.item_id,
        name: li.name_snapshot,
        unit_price_cents: li.unit_price_cents,
        quantity: li.quantity,
        modifiers: [],
      });
    }
    setSettling({ id: o.id, number: o.number });
    setShowOpen(false);
  };

  // Tapping a menu item: if it has modifier groups, open the picker; else add directly.
  const onTapItem = (item: MenuItem) => {
    if (item.modifier_group_ids?.length) {
      setModItem(item);
      setShowMods(true);
    } else {
      addItemToCart(item, []);
    }
  };

  // Add a menu item to the cart, optionally with chosen modifiers.
  const addItemToCart = (item: MenuItem, mods: SelectedModifier[]) => {
    cart.addLine({
      id: `${item.id}-${Date.now()}`,
      item_id: item.id,
      name: item.name,
      unit_price_cents: item.price_cents,
      quantity: 1,
      modifiers: mods,
    });
  };

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
        .select("id, name, price_cents, image_url, modifier_group_ids")
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
      const subtotal = cart.subtotalCents();

      // Tax + tip apply to a new sale. When settling an existing counter order we
      // just collect what's already owed (no recompute), so tax/tip are 0 here.
      const taxAmt = settling ? 0 : tax.taxCents(subtotal);
      const tipAmt = settling ? 0 : tipCents;
      const grandTotal = subtotal + taxAmt + tipAmt;

      // Recorded payment (no real processor yet). payment_method = cash | card | split.
      if (payType === "split") {
        const cashPart = Math.round((parseFloat(splitCash) || 0) * 100);
        if (cashPart <= 0 || cashPart >= grandTotal) {
          throw new Error("Enter the cash portion (less than the total); the rest goes on card.");
        }
      }
      const paymentMethod = payType; // "cash" | "card" | "split"
      const isCard = payType === "card";

      // Resolve the order we're charging: the open one we're settling, or a new sale.
      let orderId: string;
      let orderNumber: number;
      if (settling) {
        orderId = settling.id;
        orderNumber = settling.number;
      } else {
        const { data: num, error: numErr } = await (supabase as any).rpc("next_order_number", { p_merchant_id: merchantId });
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
            tax_cents: taxAmt,
            tip_cents: tipAmt,
            total_cents: grandTotal,
            payment_method: paymentMethod,
            payment_status: isCard ? "unpaid" : "paid", // card confirmed after the reader
          })
          .select("id, number")
          .single();
        if (orderErr) throw orderErr;
        orderId = (order as any).id;
        orderNumber = (order as any).number;
        // Insert each line individually so we can map the returned order_item id
        // back to its source line and persist that line's chosen modifiers.
        for (const l of lines) {
          const { data: oi, error: itemsErr } = await (supabase as any)
            .from("order_items")
            .insert({ order_id: orderId, item_id: l.item_id, name_snapshot: l.name, unit_price_cents: l.unit_price_cents, quantity: l.quantity })
            .select("id")
            .single();
          if (itemsErr) throw itemsErr;
          if (l.modifiers.length > 0) {
            const orderItemId = (oi as any).id;
            const { error: modsErr } = await (supabase as any).from("order_item_modifiers").insert(
              l.modifiers.map((m) => ({
                order_item_id: orderItemId,
                modifier_group_id: m.group_id,
                modifier_option_id: m.id,
                name_snapshot: m.name,
                price_delta_cents: m.price_delta_cents,
              })),
            );
            if (modsErr) throw modsErr;
          }
        }
      }

      if (isCard) {
        // Try the merchant's card reader; fall back to recording if none configured.
        const { result, error } = await chargeOnTerminal({
          merchantId,
          orderId,
          amountCents: grandTotal,
          onPrompt: () => Alert.alert("Tap card", "Ask the customer to tap or insert their card on the reader."),
        });
        if (result === "paid") {
          await (supabase as any).from("orders").update({ payment_method: "card", status: "completed" }).eq("id", orderId);
        } else if (result === "no_gateway") {
          // No reader configured — record the card sale (demo behavior).
          await (supabase as any).from("orders").update({ payment_method: "card", payment_status: "paid", status: "completed" }).eq("id", orderId);
        } else {
          throw new Error(error ?? "Card payment failed.");
        }
      } else if (settling) {
        const { error } = await (supabase as any)
          .from("orders")
          .update({ payment_method: paymentMethod, payment_status: "paid", status: "completed" })
          .eq("id", settling.id);
        if (error) throw error;
      }

      // Snapshot the receipt now, before the cart is cleared in onSuccess.
      const receiptData: ReceiptData = {
        storeName,
        orderNumber,
        createdAt: new Date().toISOString(),
        lines: lines.map((l) => ({
          name: l.modifiers.length > 0 ? `${l.name} (${l.modifiers.map((m) => m.name).join(", ")})` : l.name,
          qty: l.quantity,
          // Include modifier deltas in the unit price so the receipt line total matches.
          unitCents: l.unit_price_cents + l.modifiers.reduce((s, m) => s + m.price_delta_cents, 0),
        })),
        subtotalCents: subtotal,
        taxCents: taxAmt,
        tipCents: tipAmt,
        totalCents: grandTotal,
        paymentLabel: `Paid · ${paymentMethod}`,
      };

      return { number: orderNumber, receipt: receiptData };
    },
    onSuccess: (res) => {
      setReceipt(res.receipt);
      cart.clear();
      setSettling(null);
      setSplitCash("");
      setPayType("cash");
      setTipCents(0);
      setCustomTip("");
      refetchOrders();
      refetchOpen();
    },
    onError: (e) => Alert.alert("Payment failed", (e as Error).message),
  });

  // Cart totals for the footer. Settling collects what's owed (no tax/tip recompute).
  const subtotal = cart.subtotalCents();
  const taxAmt = settling ? 0 : tax.taxCents(subtotal);
  const tipAmt = settling ? 0 : tipCents;
  const grandTotal = subtotal + taxAmt + tipAmt;

  const setPresetTip = (pct: number) => {
    setTipCents(Math.round((subtotal * pct) / 100));
    setCustomTip("");
  };
  const onCustomTip = (text: string) => {
    setCustomTip(text);
    setTipCents(Math.max(0, Math.round((parseFloat(text) || 0) * 100)));
  };

  return (
    <ScreenContainer>
      <View className={`flex-1 ${wide ? "flex-row" : "flex-col"}`}>
        <View className="flex-1 p-4">
          {/* top analytics + orders strip */}
          <View className="mb-3 flex-row items-center gap-2">
            <Stat label="Today" value={fmt(todayRevenue)} />
            <Stat label="Orders" value={String(todayCount)} />
            <Stat label="Avg" value={fmt(todayAvg)} />
            <Pressable
              onPress={() => { refetchOpen(); setShowOpen(true); }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 active:bg-slate-50"
            >
              <Text className="text-xs uppercase tracking-wide text-slate-500">Open</Text>
              <Text className="mt-1 text-sm font-bold text-brand-600">{openOrders.length} ›</Text>
            </Pressable>
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
            key={wide ? "grid-4" : "grid-3"}
            data={items}
            numColumns={wide ? 4 : 3}
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
                onPress={() => onTapItem(item)}
                className="flex-1 rounded-xl border border-slate-200 bg-white p-2 active:bg-slate-50"
                style={{ maxWidth: wide ? "24%" : "32%" }}
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
        <View
          className={
            wide
              ? "w-80 border-l border-slate-200 bg-white p-4"
              : "border-t border-slate-200 bg-white p-4"
          }
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-bold">{settling ? `Order #${settling.number}` : "Cart"}</Text>
            {settling ? (
              <Pressable onPress={() => { setSettling(null); cart.clear(); }} hitSlop={8}>
                <Text className="text-sm font-medium text-red-500">Cancel</Text>
              </Pressable>
            ) : null}
          </View>
          {settling ? (
            <Text className="mt-1 text-xs text-amber-600">Collecting payment for a counter order</Text>
          ) : null}
          <FlatList
            className={wide ? "mt-3 flex-1" : "mt-3 max-h-44"}
            data={cart.lines}
            keyExtractor={(l) => l.id}
            renderItem={({ item }) => (
              <Card className="mb-2 flex-row items-center justify-between">
                <View className="flex-1 pr-2">
                  <Text className="font-semibold">{item.name}</Text>
                  <Text className="text-sm text-slate-500">
                    {item.quantity} × {fmt(item.unit_price_cents)}
                  </Text>
                  {item.modifiers.length > 0 ? (
                    <Text className="text-xs text-slate-400">
                      {item.modifiers.map((m) => m.name).join(", ")}
                    </Text>
                  ) : null}
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
            {/* tip — new sales only (settling collects the counter order as-is) */}
            {!settling ? (
              <View className="mb-3">
                <Text className="mb-2 text-sm font-semibold text-slate-500">Tip</Text>
                <View className="flex-row gap-2">
                  {([
                    { label: "No tip", pct: 0 },
                    { label: "10%", pct: 10 },
                    { label: "15%", pct: 15 },
                    { label: "20%", pct: 20 },
                  ] as const).map((p) => {
                    const sel = !customTip && tipCents === Math.round((subtotal * p.pct) / 100);
                    return (
                      <Pressable
                        key={p.label}
                        onPress={() => setPresetTip(p.pct)}
                        className="flex-1 items-center rounded-xl border py-2"
                        style={{ backgroundColor: sel ? brand : "#ffffff", borderColor: sel ? brand : "#e2e8f0" }}
                      >
                        <Text className="text-xs font-semibold" style={{ color: sel ? "#ffffff" : "#475569" }}>{p.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View className="mt-2 flex-row items-center gap-2">
                  <Text className="text-sm text-slate-500">Custom $</Text>
                  <TextInput
                    value={customTip}
                    onChangeText={onCustomTip}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </View>
              </View>
            ) : null}
            {/* totals breakdown */}
            <View className="flex-row justify-between">
              <Text className="text-sm text-slate-500">Subtotal</Text>
              <Text className="text-sm text-slate-600">{fmt(subtotal)}</Text>
            </View>
            {taxAmt > 0 ? (
              <View className="mt-1 flex-row justify-between">
                <Text className="text-sm text-slate-500">Tax{tax.ratePct ? ` (${tax.ratePct}%)` : ""}</Text>
                <Text className="text-sm text-slate-600">{fmt(taxAmt)}</Text>
              </View>
            ) : null}
            {tipAmt > 0 ? (
              <View className="mt-1 flex-row justify-between">
                <Text className="text-sm text-slate-500">Tip</Text>
                <Text className="text-sm text-slate-600">{fmt(tipAmt)}</Text>
              </View>
            ) : null}
            <View className="mt-1 flex-row justify-between border-t border-slate-200 pt-2">
              <Text className="text-base font-bold">Total</Text>
              <Text className="text-base font-bold">{fmt(grandTotal)}</Text>
            </View>
            {/* payment type: cash / card / split */}
            <View className="mt-3">
              <Text className="mb-2 text-sm font-semibold text-slate-500">Payment</Text>
              <View className="flex-row gap-2">
                {(["cash", "card", "split"] as const).map((t) => {
                  const sel = payType === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setPayType(t)}
                      className="flex-1 items-center rounded-xl border py-2"
                      style={{ backgroundColor: sel ? brand : "#ffffff", borderColor: sel ? brand : "#e2e8f0" }}
                    >
                      <Text className="text-sm font-semibold capitalize" style={{ color: sel ? "#ffffff" : "#475569" }}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {payType === "split" ? (
                <View className="mt-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm text-slate-500">Cash</Text>
                    <TextInput
                      value={splitCash}
                      onChangeText={setSplitCash}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </View>
                  <Text className="mt-1 text-xs text-slate-400">
                    Card: {fmt(Math.max(0, grandTotal - Math.round((parseFloat(splitCash) || 0) * 100)))}
                  </Text>
                </View>
              ) : null}
            </View>
            <Button
              label={charge.isPending ? "Processing…" : `${settling ? "Collect" : "Charge"} ${fmt(grandTotal)}`}
              size="lg"
              className="mt-4"
              style={{ backgroundColor: brand }}
              disabled={cart.lines.length === 0 || charge.isPending}
              onPress={() => charge.mutate()}
            />
            <Button
              label="Clear"
              variant="ghost"
              className="mt-2"
              onPress={() => { cart.clear(); setSettling(null); setSplitCash(""); }}
            />
          </View>
        </View>
      </View>

      {/* Open ("pay at counter") orders modal */}
      <Modal visible={showOpen} animationType="slide" transparent onRequestClose={() => setShowOpen(false)}>
        <Pressable onPress={() => setShowOpen(false)} className="flex-1 bg-slate-900/40" />
        <View className="absolute bottom-0 left-0 right-0 max-h-[75%] rounded-t-3xl bg-white">
          <View className="flex-row items-center justify-between border-b border-slate-100 px-5 py-4">
            <Text className="text-lg font-bold">Open orders · pay at counter</Text>
            <Pressable onPress={() => setShowOpen(false)} hitSlop={8}>
              <Text className="text-sm font-medium text-brand-600">Close</Text>
            </Pressable>
          </View>
          <FlatList
            data={openOrders}
            keyExtractor={(o) => o.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => loadOpenOrder(item)}
                className="flex-row items-center justify-between rounded-xl border border-slate-200 p-4 active:bg-slate-50"
              >
                <View className="flex-1">
                  <Text className="font-semibold">#{item.number} · {item.order_type === "dine_in" ? "Dine in" : "To go"}</Text>
                  <Text className="text-xs text-slate-400">
                    {(item.order_items?.length ?? 0)} item{(item.order_items?.length ?? 0) === 1 ? "" : "s"} · {item.source} · {new Date(item.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </Text>
                </View>
                <Text className="mr-2 font-semibold">{fmt(item.total_cents)}</Text>
                <Text className="text-brand-600">Collect ›</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text className="mt-8 text-center text-slate-400">No open orders.</Text>}
          />
        </View>
      </Modal>

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

      {/* Receipt modal — shown after a successful charge */}
      <Modal visible={receipt !== null} animationType="slide" transparent onRequestClose={() => setReceipt(null)}>
        <Pressable onPress={() => setReceipt(null)} className="flex-1 bg-slate-900/40" />
        <View className="absolute bottom-0 left-0 right-0 max-h-[85%] rounded-t-3xl bg-white">
          <View className="flex-row items-center justify-between border-b border-slate-100 px-5 py-4">
            <Text className="text-lg font-bold">Receipt</Text>
            <Pressable onPress={() => setReceipt(null)} hitSlop={8}>
              <Text className="text-sm font-medium text-brand-600">Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {receipt ? <Receipt data={receipt} /> : null}
            <Button
              label="New sale"
              size="lg"
              className="mt-4"
              style={{ backgroundColor: brand }}
              onPress={() => setReceipt(null)}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Modifier picker — shown when adding an item that has modifier groups */}
      <ModifierSheet
        visible={showMods}
        item={modItem}
        brand={brand}
        onClose={() => { setShowMods(false); setModItem(null); }}
        onConfirm={(mods) => {
          if (modItem) addItemToCart(modItem, mods);
          setShowMods(false);
          setModItem(null);
        }}
      />
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
