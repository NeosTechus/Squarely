import { useEffect, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, Alert, Image, Modal, ScrollView, useWindowDimensions } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button, ScreenContainer, Card } from "@squarely/ui-mobile";
import { useCart } from "@/store/cart";
import { supabase } from "@/lib/supabase";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import { useMerchantTheme } from "@/lib/useMerchantTheme";
import { useMerchantFeatures } from "@/lib/useMerchantFeatures";
import { chargeOnTerminal } from "@/lib/terminalCharge";
import { sendReceiptEmail, sendReceiptSms } from "@/lib/sendReceipt";
import { sendReceiptPrint } from "@/lib/sendReceiptPrint";
import { useMerchantTax } from "@/lib/useMerchantTax";
import { OrderRow } from "@/components/OrderRow";
import { Receipt, type ReceiptData } from "@/components/Receipt";
import { ModifierSheet, type SelectedModifier } from "@/components/ModifierSheet";
import { UpiQr, buildUpiUri } from "@/components/UpiQr";

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
  // The order id that backs the active receipt — needed for emailing.
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
  // Inline email-receipt UX state.
  const [emailDraft, setEmailDraft] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Inline SMS-receipt UX state (mirrors email).
  const [smsDraft, setSmsDraft] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsMsg, setSmsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Inline print-receipt UX state (no input — single-press dispatch).
  const [printSending, setPrintSending] = useState(false);
  const [printMsg, setPrintMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { data: features } = useMerchantFeatures();

  // Has an enabled printer registered for this merchant? If not, the Print
  // card stays hidden even when the toggle is on.
  const { data: hasPrinter = false } = useQuery({
    enabled: Boolean(merchantId) && (features?.print_receipts ?? false),
    queryKey: ["pos-has-printer", merchantId],
    queryFn: async (): Promise<boolean> => {
      const { data } = await (supabase as any)
        .from("printers")
        .select("id")
        .eq("merchant_id", merchantId)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      return Boolean(data?.id);
    },
  });

  // Payment: cash / card / split / upi. For split, the cashier enters the cash part.
  type PayType = "cash" | "card" | "split" | "upi";
  const [payType, setPayType] = useState<PayType>("cash");
  const [splitCash, setSplitCash] = useState("");
  const [showUpi, setShowUpi] = useState(false);

  // UPI gateway (India scan-to-pay): present only if the merchant enabled it.
  const { data: upi } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["pos-upi-gateway", merchantId],
    queryFn: async (): Promise<{ upiVpa: string; payeeName: string; qrImageUrl: string | null } | null> => {
      const { data } = await (supabase as any)
        .from("merchant_payment_gateways")
        .select("public_config")
        .eq("merchant_id", merchantId)
        .eq("provider", "upi")
        .eq("enabled", true)
        .maybeSingle();
      const cfg = data?.public_config;
      if (!cfg) return null;
      const upiVpa = cfg.upiVpa ? String(cfg.upiVpa) : "";
      const qrImageUrl = cfg.qrImageUrl ? String(cfg.qrImageUrl) : null;
      if (!upiVpa && !qrImageUrl) return null;
      return { upiVpa, payeeName: String(cfg.payeeName ?? ""), qrImageUrl };
    },
  });

  // If UPI gets disabled (or we switch tenants), don't leave "upi" selected.
  useEffect(() => {
    if (payType === "upi" && !upi) setPayType("cash");
  }, [upi, payType]);

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
  // Gated on `open_tabs_enabled` so the auto-expire mutation below doesn't fire
  // (and we don't surface a queue the merchant has turned off).
  const { data: openOrders = [], refetch: refetchOpen } = useQuery({
    enabled: Boolean(merchantId) && (features?.open_tabs_enabled ?? true),
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
  // When the modifiers feature is disabled for this merchant we skip the picker
  // entirely and add the item with no modifiers — so cashiers never get stuck on
  // a hidden sheet for an item that still has modifier_group_ids assigned.
  const onTapItem = (item: MenuItem) => {
    const modifiersEnabled = features?.modifiers_enabled ?? true;
    if (modifiersEnabled && item.modifier_group_ids?.length) {
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
      // Tip is also force-zeroed when the merchant has tips disabled, so even a
      // stale `tipCents` value can never sneak onto a charge.
      const tipsEnabled = features?.tips_enabled ?? true;
      const taxAmt = settling ? 0 : tax.taxCents(subtotal);
      const tipAmt = settling || !tipsEnabled ? 0 : tipCents;
      const grandTotal = subtotal + taxAmt + tipAmt;

      // Recorded payment. payment_method = cash | card | split | upi.
      // For "split" the cash portion is collected at the counter; the rest hits the card reader.
      let splitCardAmount = 0;
      if (payType === "split") {
        const cashPart = Math.round((parseFloat(splitCash) || 0) * 100);
        if (cashPart <= 0 || cashPart >= grandTotal) {
          throw new Error("Enter the cash portion (less than the total); the rest goes on card.");
        }
        splitCardAmount = grandTotal - cashPart;
      }
      const paymentMethod = payType; // "cash" | "card" | "split" | "upi"
      const needsReader = payType === "card" || payType === "split";
      const isCard = payType === "card";

      // Resolve the order we're charging: the open one we're settling, or a new sale.
      let orderId: string;
      let orderNumber: number;
      if (settling) {
        orderId = settling.id;
        orderNumber = settling.number;
      } else {
        // Atomic write: the RPC inserts orders + order_items + order_item_modifiers
        // in a single transaction so a partial sale can't be left behind if any
        // line/modifier insert fails. The function also allocates the next order
        // number for the merchant on the server, replacing the prior client-side
        // next_order_number call.
        const { data, error: rpcErr } = await (supabase as any).rpc("create_order_with_items", {
          p_merchant_id: merchantId,
          p_order: {
            source: "pos",
            order_type: "take_out",
            status: "completed",
            subtotal_cents: subtotal,
            tax_cents: taxAmt,
            tip_cents: tipAmt,
            total_cents: grandTotal,
            payment_method: paymentMethod,
            // Card and split orders stay "unpaid" until the reader confirms; cash/upi paid immediately.
            payment_status: needsReader ? "unpaid" : "paid",
          },
          p_items: lines.map((l) => ({
            item_id: l.item_id,
            name_snapshot: l.name,
            unit_price_cents: l.unit_price_cents,
            quantity: l.quantity,
            modifiers: l.modifiers.map((m) => ({
              modifier_group_id: m.group_id,
              modifier_option_id: m.id,
              name_snapshot: m.name,
              price_delta_cents: m.price_delta_cents,
            })),
          })),
        });
        if (rpcErr) throw rpcErr;
        const row = Array.isArray(data) ? data[0] : data;
        orderId = row.order_id as string;
        orderNumber = row.order_number as number;
      }

      if (needsReader) {
        // For a full-card sale we charge the grand total; for a split we charge
        // only the card portion (the cash portion is collected at the counter).
        const chargeAmount = isCard ? grandTotal : splitCardAmount;
        const { result, error } = await chargeOnTerminal({
          merchantId,
          orderId,
          amountCents: chargeAmount,
          onPrompt: () => Alert.alert("Tap card", "Ask the customer to tap or insert their card on the reader."),
        });
        if (result === "paid") {
          await (supabase as any).from("orders").update({ payment_status: "paid", status: "completed" }).eq("id", orderId);
        } else if (result === "no_gateway") {
          // No reader configured — record the sale anyway (demo behavior).
          await (supabase as any).from("orders").update({ payment_status: "paid", status: "completed" }).eq("id", orderId);
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

      return { id: orderId, number: orderNumber, receipt: receiptData };
    },
    onSuccess: (res) => {
      setReceipt(res.receipt);
      setReceiptOrderId(res.id);
      setEmailDraft("");
      setEmailMsg(null);
      setSmsDraft("");
      setSmsMsg(null);
      setPrintMsg(null);
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
  // Mirror the same tips-disabled guard used in the charge mutation so the
  // displayed totals (and the "Charge X" button label) match what we'd actually post.
  const tipsEnabled = features?.tips_enabled ?? true;
  const subtotal = cart.subtotalCents();
  const taxAmt = settling ? 0 : tax.taxCents(subtotal);
  const tipAmt = settling || !tipsEnabled ? 0 : tipCents;
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
            {(features?.open_tabs_enabled ?? true) ? (
              <Pressable
                onPress={() => { refetchOpen(); setShowOpen(true); }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 active:bg-slate-50"
              >
                <Text className="text-xs uppercase tracking-wide text-slate-500">Open</Text>
                <Text className="mt-1 text-sm font-bold text-brand-600">{openOrders.length} ›</Text>
              </Pressable>
            ) : null}
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
            {/* tip — new sales only (settling collects the counter order as-is),
                and only when the merchant has tips enabled. */}
            {!settling && tipsEnabled ? (
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
            {/* payment type: cash / card / split / upi */}
            <View className="mt-3">
              <Text className="mb-2 text-sm font-semibold text-slate-500">Payment</Text>
              <View className="flex-row flex-wrap gap-2">
                {(["cash", "card", "split", ...(upi ? (["upi"] as const) : [])] as PayType[]).map((t) => {
                  const sel = payType === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setPayType(t)}
                      className="flex-1 items-center rounded-xl border py-2"
                      style={{ backgroundColor: sel ? brand : "#ffffff", borderColor: sel ? brand : "#e2e8f0" }}
                    >
                      <Text className="text-sm font-semibold capitalize" style={{ color: sel ? "#ffffff" : "#475569" }}>{t === "upi" ? "UPI" : t}</Text>
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
              onPress={() => (payType === "upi" ? setShowUpi(true) : charge.mutate())}
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

      {/* Open ("pay at counter") orders modal — defensively gated so stale state
          can't pop the sheet after the feature is turned off. */}
      <Modal visible={showOpen && (features?.open_tabs_enabled ?? true)} animationType="slide" transparent onRequestClose={() => setShowOpen(false)}>
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
            {features?.email_receipts && receiptOrderId ? (
              <View className="mt-4 rounded-2xl border border-slate-200 p-3">
                <Text className="mb-2 text-xs uppercase tracking-wide text-slate-500">Email receipt</Text>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={emailDraft}
                    onChangeText={setEmailDraft}
                    placeholder="customer@example.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <Pressable
                    disabled={emailSending || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailDraft.trim())}
                    onPress={async () => {
                      setEmailSending(true);
                      setEmailMsg(null);
                      const r = await sendReceiptEmail({ orderId: receiptOrderId, email: emailDraft.trim() });
                      setEmailSending(false);
                      setEmailMsg(r.ok ? { ok: true, text: "Sent." } : { ok: false, text: r.error });
                    }}
                    className="rounded-lg bg-brand-600 px-3 py-2 disabled:opacity-50"
                    style={{ backgroundColor: brand }}
                  >
                    <Text className="text-sm font-semibold text-white">{emailSending ? "…" : "Send"}</Text>
                  </Pressable>
                </View>
                {emailMsg ? (
                  <Text className={`mt-2 text-xs ${emailMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                    {emailMsg.text}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {features?.print_receipts && receiptOrderId && hasPrinter ? (
              <View className="mt-3 rounded-2xl border border-slate-200 p-3">
                <Text className="mb-2 text-xs uppercase tracking-wide text-slate-500">Print receipt</Text>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-sm text-slate-600">Send to the default printer.</Text>
                  <Pressable
                    disabled={printSending}
                    onPress={async () => {
                      setPrintSending(true);
                      setPrintMsg(null);
                      const r = await sendReceiptPrint({ orderId: receiptOrderId });
                      setPrintSending(false);
                      setPrintMsg(r.ok ? { ok: true, text: "Queued for printing." } : { ok: false, text: r.error });
                    }}
                    className="rounded-lg bg-brand-600 px-3 py-2 disabled:opacity-50"
                    style={{ backgroundColor: brand }}
                  >
                    <Text className="text-sm font-semibold text-white">{printSending ? "…" : "Print"}</Text>
                  </Pressable>
                </View>
                {printMsg ? (
                  <Text className={`mt-2 text-xs ${printMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                    {printMsg.text}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {features?.sms_receipts && receiptOrderId ? (
              <View className="mt-3 rounded-2xl border border-slate-200 p-3">
                <Text className="mb-2 text-xs uppercase tracking-wide text-slate-500">SMS receipt</Text>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={smsDraft}
                    onChangeText={setSmsDraft}
                    placeholder="+15551234567"
                    autoCapitalize="none"
                    keyboardType="phone-pad"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <Pressable
                    disabled={smsSending || !/^\+?[1-9]\d{6,15}$/.test(smsDraft.replace(/[\s\-()]/g, ""))}
                    onPress={async () => {
                      setSmsSending(true);
                      setSmsMsg(null);
                      const r = await sendReceiptSms({ orderId: receiptOrderId, phone: smsDraft.trim() });
                      setSmsSending(false);
                      setSmsMsg(r.ok ? { ok: true, text: "Sent." } : { ok: false, text: r.error });
                    }}
                    className="rounded-lg px-3 py-2 disabled:opacity-50"
                    style={{ backgroundColor: brand }}
                  >
                    <Text className="text-sm font-semibold text-white">{smsSending ? "…" : "Send"}</Text>
                  </Pressable>
                </View>
                {smsMsg ? (
                  <Text className={`mt-2 text-xs ${smsMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                    {smsMsg.text}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Button
              label="New sale"
              size="lg"
              className="mt-4"
              style={{ backgroundColor: brand }}
              onPress={() => { setReceipt(null); setReceiptOrderId(null); }}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* UPI scan-to-pay — customer scans the QR, cashier confirms receipt */}
      <Modal visible={showUpi} animationType="slide" transparent onRequestClose={() => setShowUpi(false)}>
        <Pressable onPress={() => setShowUpi(false)} className="flex-1 bg-slate-900/40" />
        <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white">
          <View className="flex-row items-center justify-between border-b border-slate-100 px-5 py-4">
            <Text className="text-lg font-bold">Scan to pay · UPI</Text>
            <Pressable onPress={() => setShowUpi(false)} hitSlop={8}>
              <Text className="text-sm font-medium text-brand-600">Cancel</Text>
            </Pressable>
          </View>
          <View className="items-center px-5 py-6">
            <Text className="text-3xl font-bold">{fmt(grandTotal)}</Text>
            {upi ? (
              <>
                <View className="mt-5 rounded-2xl border border-slate-200 p-4">
                  {upi.upiVpa ? (
                    <UpiQr
                      value={buildUpiUri({
                        vpa: upi.upiVpa,
                        payeeName: upi.payeeName,
                        amountCents: grandTotal,
                        note: settling ? `Order #${settling.number}` : undefined,
                      })}
                    />
                  ) : (
                    <Image source={{ uri: upi.qrImageUrl! }} style={{ width: 220, height: 220 }} resizeMode="contain" />
                  )}
                </View>
                {upi.payeeName ? <Text className="mt-4 text-sm text-slate-500">{upi.payeeName}</Text> : null}
                {upi.upiVpa ? (
                  <Text className="text-xs text-slate-400">{upi.upiVpa}</Text>
                ) : (
                  <Text className="mt-3 px-6 text-center text-xs text-amber-600">
                    Enter {fmt(grandTotal)} in the customer&apos;s UPI app — this QR doesn&apos;t carry the amount.
                  </Text>
                )}
                <Text className="mt-3 px-6 text-center text-xs text-slate-400">
                  Customer scans with any UPI app (Google Pay, PhonePe, Paytm). Confirm once their payment succeeds.
                </Text>
              </>
            ) : null}
            <Button
              label={charge.isPending ? "Saving…" : "Mark received"}
              size="lg"
              className="mt-6 w-full"
              style={{ backgroundColor: brand }}
              disabled={charge.isPending}
              onPress={() => { setShowUpi(false); charge.mutate(); }}
            />
          </View>
        </View>
      </Modal>

      {/* Modifier picker — shown when adding an item that has modifier groups.
          Defensively AND-gated on `modifiers_enabled` so the sheet can never
          render if the feature is toggled off mid-session. */}
      <ModifierSheet
        visible={showMods && (features?.modifiers_enabled ?? true)}
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
