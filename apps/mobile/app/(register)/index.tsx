import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, ScreenContainer, Card } from "@squarely/ui-mobile";
import { supabase } from "@/lib/supabase";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import { useMerchantTheme } from "@/lib/useMerchantTheme";
import { useMerchantFeatures } from "@/lib/useMerchantFeatures";
import { useMerchantTax } from "@/lib/useMerchantTax";
import { sendReceiptEmail, sendReceiptSms } from "@/lib/sendReceipt";
import { sendReceiptPrint } from "@/lib/sendReceiptPrint";
import { UpiQr, buildUpiUri } from "@/components/UpiQr";

interface RegisterItem {
  id: string;
  name: string;
  price_cents: number;
  barcode: string | null;
  sold_by_weight: boolean | null;
  weight_unit: string | null;
}

// Cart lines: either a count item (with integer qty) or a weighed item (decimal weight).
type CartLine =
  | {
      kind: "count";
      lineId: string;
      itemId: string;
      name: string;
      unitPriceCents: number;
      qty: number;
    }
  | {
      kind: "weighed";
      lineId: string;
      itemId: string;
      name: string;
      pricePerUnitCents: number;
      weight: number;
      weightUnit: string;
    };

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
const weighedLineTotal = (l: Extract<CartLine, { kind: "weighed" }>): number =>
  Math.round(l.pricePerUnitCents * l.weight);
const lineTotalCents = (l: CartLine): number =>
  l.kind === "count" ? l.unitPriceCents * l.qty : weighedLineTotal(l);

// A USB/Bluetooth barcode scanner types a numeric code then sends "Enter".
// Anything 6+ digits we treat as a barcode lookup; otherwise it's free-text search.
const looksLikeBarcode = (s: string) => /^\d{6,}$/.test(s.trim());

export default function Register() {
  const qc = useQueryClient();
  const { data: merchantId } = useActiveMerchant();
  const brand = useMerchantTheme();
  const tax = useMerchantTax();

  // Self-contained register cart — POS's global useCart has different modifier
  // semantics, so we keep this local instead of sharing it.
  const [lines, setLines] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [payType, setPayType] = useState<"cash" | "card" | "upi">("cash");
  const [showUpi, setShowUpi] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [emailModal, setEmailModal] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [smsModal, setSmsModal] = useState(false);
  const [smsDraft, setSmsDraft] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsMsg, setSmsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Print is a single-press dispatch (no input); we just need an in-flight flag
  // and a transient toast-style banner. Result is shown in the confirmation row
  // until the auto-hide timeout fires.
  const [printSending, setPrintSending] = useState(false);
  const [printMsg, setPrintMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { data: features } = useMerchantFeatures();

  // Has an enabled printer registered for this merchant? Mirrors the POS query
  // so the Print pill only shows when there's actually a target.
  const { data: hasPrinter = false } = useQuery({
    enabled: Boolean(merchantId) && (features?.print_receipts ?? false),
    queryKey: ["register-has-printer", merchantId],
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

  // Weighed-item prompt: either a fresh add or editing an existing line.
  type WeighedPrompt =
    | { mode: "add"; item: RegisterItem }
    | { mode: "edit"; lineId: string; name: string; pricePerUnitCents: number; weightUnit: string; initial: string };
  const [weighedPrompt, setWeighedPrompt] = useState<WeighedPrompt | null>(null);
  const [weightInput, setWeightInput] = useState("");

  // Quick-add modal for an unknown scanned barcode.
  const [quickAdd, setQuickAdd] = useState<{ barcode: string } | null>(null);
  const [qaName, setQaName] = useState("");
  const [qaPrice, setQaPrice] = useState("");
  const [qaSoldByWeight, setQaSoldByWeight] = useState(false);
  const [qaWeightUnit, setQaWeightUnit] = useState("kg");

  const scanRef = useRef<TextInput | null>(null);
  const refocusScan = () => {
    // setTimeout so any modal close animation can settle before we steal focus back.
    setTimeout(() => scanRef.current?.focus(), 50);
  };
  // Register is built for USB / Bluetooth-HID barcode scanners — those send
  // keystrokes without ever needing the soft keyboard. On Android the focused
  // TextInput would otherwise pop the soft keyboard over the cart on every
  // screen entry and modal close. Default to keyboard suppressed; let the
  // cashier tap "Type" to bring it up for a manual search.
  const [softKeyboard, setSoftKeyboard] = useState(false);

  // UPI gateway (India scan-to-pay): same shape as POS, only present if enabled.
  const { data: upi } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["register-upi-gateway", merchantId],
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

  // Items catalog (active, current merchant). Pulls the new sold_by_weight columns —
  // if the migration hasn't been applied yet this will surface as a visible error.
  const {
    data: items = [],
    isLoading,
    error: itemsError,
  } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["register-items", merchantId],
    queryFn: async (): Promise<RegisterItem[]> => {
      const { data, error } = await (supabase as any)
        .from("items")
        .select("id, name, price_cents, barcode, sold_by_weight, weight_unit")
        .eq("merchant_id", merchantId)
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as RegisterItem[];
    },
  });

  // Live search results — up to 8 — by name or barcode prefix/substring.
  const searchResults = useMemo<RegisterItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const matches = items.filter((it) => {
      const name = it.name?.toLowerCase() ?? "";
      const bc = (it.barcode ?? "").toLowerCase();
      return name.includes(q) || bc.includes(q);
    });
    return matches.slice(0, 8);
  }, [items, query]);

  // Append-or-merge: count items stack by id; weighed items always get a new line.
  const addCountItem = (item: RegisterItem) => {
    setLines((prev) => {
      const hasExisting = prev.some((l) => l.kind === "count" && l.itemId === item.id);
      if (hasExisting) {
        return prev.map((l) =>
          l.kind === "count" && l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          kind: "count",
          lineId: `${item.id}-${Date.now()}`,
          itemId: item.id,
          name: item.name,
          unitPriceCents: item.price_cents,
          qty: 1,
        },
      ];
    });
  };

  const addItem = (item: RegisterItem) => {
    if (item.sold_by_weight) {
      setWeighedPrompt({ mode: "add", item });
      setWeightInput("");
      return;
    }
    addCountItem(item);
    setQuery("");
    refocusScan();
  };

  // Scan/Enter submitted: numeric barcode → exact lookup (or quick-add if unknown);
  // otherwise treat Enter as "select the top search match".
  const onSubmitScan = async () => {
    const value = query.trim();
    if (!value) return;
    if (looksLikeBarcode(value)) {
      const match = items.find((it) => (it.barcode ?? "") === value);
      if (match) {
        addItem(match);
        return;
      }
      setQuickAdd({ barcode: value });
      setQaName("");
      setQaPrice("");
      setQaSoldByWeight(false);
      setQaWeightUnit("kg");
      return;
    }
    const top = searchResults[0];
    if (top) {
      addItem(top);
    }
  };

  const confirmWeighed = () => {
    if (!weighedPrompt) return;
    const w = parseFloat(weightInput);
    if (!Number.isFinite(w) || w <= 0) {
      Alert.alert("Invalid weight", "Enter a weight greater than zero.");
      return;
    }
    if (weighedPrompt.mode === "add") {
      const { item } = weighedPrompt;
      const unit = item.weight_unit || "kg";
      setLines((prev) => [
        ...prev,
        {
          kind: "weighed",
          lineId: `${item.id}-${Date.now()}`,
          itemId: item.id,
          name: item.name,
          pricePerUnitCents: item.price_cents,
          weight: w,
          weightUnit: unit,
        },
      ]);
    } else {
      const id = weighedPrompt.lineId;
      setLines((prev) =>
        prev.map((l) =>
          l.kind === "weighed" && l.lineId === id ? { ...l, weight: w } : l,
        ),
      );
    }
    setWeighedPrompt(null);
    setWeightInput("");
    setQuery("");
    refocusScan();
  };

  const editWeighedLine = (l: Extract<CartLine, { kind: "weighed" }>) => {
    setWeighedPrompt({
      mode: "edit",
      lineId: l.lineId,
      name: l.name,
      pricePerUnitCents: l.pricePerUnitCents,
      weightUnit: l.weightUnit,
      initial: l.weight.toFixed(3),
    });
    setWeightInput(l.weight.toFixed(3));
  };

  const removeLine = (lineId: string) =>
    setLines((prev) => prev.filter((l) => l.lineId !== lineId));
  const incCount = (lineId: string) =>
    setLines((prev) =>
      prev.map((l) =>
        l.kind === "count" && l.lineId === lineId ? { ...l, qty: l.qty + 1 } : l,
      ),
    );
  const decCount = (lineId: string) =>
    setLines((prev) =>
      prev
        .map((l) =>
          l.kind === "count" && l.lineId === lineId ? { ...l, qty: l.qty - 1 } : l,
        )
        .filter((l) => !(l.kind === "count" && l.qty <= 0)),
    );

  // Save the unknown barcode as a new item, then drop it straight into the cart.
  const saveQuickAdd = async () => {
    if (!quickAdd || !merchantId) return;
    const name = qaName.trim();
    const priceDollars = parseFloat(qaPrice);
    if (!name) {
      Alert.alert("Name required", "Give the item a name.");
      return;
    }
    if (!Number.isFinite(priceDollars) || priceDollars < 0) {
      Alert.alert("Price required", "Enter a valid price.");
      return;
    }
    const priceCents = Math.round(priceDollars * 100);
    const weightUnit = qaSoldByWeight ? (qaWeightUnit.trim() || "kg") : null;
    const { data, error } = await (supabase as any)
      .from("items")
      .insert({
        merchant_id: merchantId,
        name,
        price_cents: priceCents,
        barcode: quickAdd.barcode,
        sold_by_weight: qaSoldByWeight,
        weight_unit: weightUnit,
        active: true,
      })
      .select("id, name, price_cents, barcode, sold_by_weight, weight_unit")
      .single();
    if (error) {
      Alert.alert("Couldn't save item", error.message);
      return;
    }
    const inserted = data as RegisterItem;
    setQuickAdd(null);
    // Refresh the catalog so the new item shows up in future searches.
    await qc.invalidateQueries({ queryKey: ["register-items", merchantId] });
    setQuery("");
    if (inserted.sold_by_weight) {
      setWeighedPrompt({ mode: "add", item: inserted });
      setWeightInput("");
    } else {
      addCountItem(inserted);
      refocusScan();
    }
  };

  // Totals
  const subtotal = lines.reduce((s, l) => s + lineTotalCents(l), 0);
  const taxAmt = tax.taxCents(subtotal);
  const grandTotal = subtotal + taxAmt;

  // Build a descriptive name_snapshot for a weighed line that captures what we
  // sold — used on the order_items row since quantity must stay an integer.
  const weighedSnapshot = (l: Extract<CartLine, { kind: "weighed" }>) =>
    `${l.name} · ${l.weight.toFixed(3)} ${l.weightUnit} @ ${fmt(l.pricePerUnitCents)}/${l.weightUnit}`;

  const charge = useMutation({
    mutationFn: async () => {
      if (!merchantId) throw new Error("No active merchant.");
      if (lines.length === 0) throw new Error("Cart is empty.");

      const paymentMethod = payType; // "cash" | "card" | "upi"
      const isCard = paymentMethod === "card";

      // Atomic write: orders + order_items in a single transaction. Weighed
      // lines collapse to quantity=1 with the line total as unit_price_cents
      // and a descriptive name_snapshot — `quantity` is an integer column so
      // this is the cleanest way to preserve the sale total while keeping a
      // per-line audit trail. Register has no modifiers, so we omit them.
      const p_items = lines.map((l) =>
        l.kind === "count"
          ? {
              item_id: l.itemId,
              name_snapshot: l.name,
              unit_price_cents: l.unitPriceCents,
              quantity: l.qty,
            }
          : {
              item_id: l.itemId,
              name_snapshot: weighedSnapshot(l),
              unit_price_cents: weighedLineTotal(l),
              quantity: 1,
            },
      );

      const { data, error: rpcErr } = await (supabase as any).rpc("create_order_with_items", {
        p_merchant_id: merchantId,
        p_order: {
          source: "pos",
          order_type: "take_out",
          status: "completed",
          subtotal_cents: subtotal,
          tax_cents: taxAmt,
          total_cents: grandTotal,
          payment_method: paymentMethod,
          // Card readers in supermarkets are external (separate terminal), so we
          // record the sale as 'unpaid' until the cashier confirms on the device —
          // no chargeOnTerminal call here (unlike the cafe POS).
          payment_status: isCard ? "unpaid" : "paid",
        },
        p_items,
      });
      if (rpcErr) throw rpcErr;
      const row = Array.isArray(data) ? data[0] : data;
      const orderId = row.order_id as string;
      const orderNumber = row.order_number as number;

      return { id: orderId, number: orderNumber, total: grandTotal };
    },
    onSuccess: (res) => {
      setConfirmation(`✓ Sold #${res.number} · ${fmt(res.total)}`);
      setLastOrderId(res.id);
      setLines([]);
      setQuery("");
      setPayType("cash");
      // Auto-hide the banner so it doesn't linger forever. We keep lastOrderId
      // around so the "Email receipt" button stays usable a bit longer.
      setTimeout(() => setConfirmation(null), 4000);
      refocusScan();
    },
    onError: (e) => Alert.alert("Charge failed", (e as Error).message),
  });

  const chargeDisabled = lines.length === 0 || charge.isPending;
  const onChargePress = () => {
    if (chargeDisabled) return;
    if (payType === "upi") {
      setShowUpi(true);
      return;
    }
    charge.mutate();
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Text className="mb-2 text-2xl font-bold">Register</Text>

        {confirmation ? (
          <View className="mb-3 flex-row items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <Text className="text-sm font-semibold text-emerald-700">{confirmation}</Text>
            <View className="flex-row items-center gap-2">
              {features?.email_receipts && lastOrderId ? (
                <Pressable
                  onPress={() => { setEmailDraft(""); setEmailMsg(null); setEmailModal(true); }}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5"
                >
                  <Text className="text-xs font-semibold text-white">Email receipt</Text>
                </Pressable>
              ) : null}
              {features?.sms_receipts && lastOrderId ? (
                <Pressable
                  onPress={() => { setSmsDraft(""); setSmsMsg(null); setSmsModal(true); }}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5"
                >
                  <Text className="text-xs font-semibold text-white">SMS receipt</Text>
                </Pressable>
              ) : null}
              {features?.print_receipts && lastOrderId && hasPrinter ? (
                <Pressable
                  disabled={printSending}
                  onPress={async () => {
                    if (!lastOrderId) return;
                    setPrintSending(true);
                    setPrintMsg(null);
                    const r = await sendReceiptPrint({ orderId: lastOrderId });
                    setPrintSending(false);
                    setPrintMsg(r.ok ? { ok: true, text: "Printing." } : { ok: false, text: r.error });
                    // Clear the message after 3s so it doesn't linger past the banner.
                    setTimeout(() => setPrintMsg(null), 3000);
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 disabled:opacity-50"
                >
                  <Text className="text-xs font-semibold text-white">
                    {printSending ? "Printing…" : "Print receipt"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
        {printMsg ? (
          <View className={`mb-3 rounded-xl border px-4 py-2 ${printMsg.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <Text className={`text-xs font-medium ${printMsg.ok ? "text-emerald-700" : "text-red-700"}`}>
              {printMsg.text}
            </Text>
          </View>
        ) : null}

        {/* Scan / search capture */}
        <View className="mb-3">
          <View className="flex-row items-center gap-2">
            <TextInput
              ref={scanRef}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={onSubmitScan}
              blurOnSubmit={false}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              placeholder="Scan or search…"
              // Suppress the Android soft keyboard for HID scanner ergonomics
              // (see softKeyboard state above). iOS ignores this prop and
              // already hides the keyboard when an external HID keyboard is
              // connected.
              showSoftInputOnFocus={Platform.OS === "android" ? softKeyboard : undefined}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base"
            />
            {Platform.OS === "android" ? (
              <Pressable
                onPress={() => {
                  setSoftKeyboard((v) => {
                    const next = !v;
                    // Refocus so the keyboard state actually applies on the next
                    // focus cycle (Android only re-reads showSoftInputOnFocus on
                    // focus, not on prop change).
                    setTimeout(() => {
                      scanRef.current?.blur();
                      setTimeout(() => scanRef.current?.focus(), 30);
                    }, 0);
                    return next;
                  });
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-3"
              >
                <Text className="text-xs font-semibold text-slate-600">
                  {softKeyboard ? "Hide" : "Type"}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {/* Live search dropdown */}
          {query.trim().length > 0 && !looksLikeBarcode(query.trim()) && searchResults.length > 0 ? (
            <View className="mt-1 rounded-xl border border-slate-200 bg-white">
              {searchResults.map((it) => (
                <Pressable
                  key={it.id}
                  onPress={() => addItem(it)}
                  className="flex-row items-center justify-between border-b border-slate-100 px-3 py-2 active:bg-slate-50"
                >
                  <View className="flex-1 pr-2">
                    <Text className="font-semibold" numberOfLines={1}>{it.name}</Text>
                    {it.barcode ? (
                      <Text className="text-xs text-slate-400" numberOfLines={1}>{it.barcode}</Text>
                    ) : null}
                  </View>
                  <Text className="text-sm font-semibold text-slate-600">
                    {fmt(it.price_cents)}
                    {it.sold_by_weight ? `/${it.weight_unit || "kg"}` : ""}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {isLoading ? <ActivityIndicator className="mt-3" /> : null}
          {itemsError ? (
            <Text className="mt-3 text-sm text-red-600">
              Couldn&apos;t load items: {(itemsError as Error).message}
            </Text>
          ) : null}
        </View>

        {/* Cart */}
        <Text className="mb-2 text-lg font-bold">Cart</Text>
        {lines.length === 0 ? (
          <Text className="mb-4 text-center text-slate-400">Scan an item to begin</Text>
        ) : (
          <View className="mb-3">
            {lines.map((l) => {
              const total = lineTotalCents(l);
              if (l.kind === "count") {
                return (
                  <Card key={l.lineId} className="mb-2 flex-row items-center justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="font-semibold" numberOfLines={1}>{l.name}</Text>
                      <Text className="text-xs text-slate-500">
                        {l.qty} × {fmt(l.unitPriceCents)}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Pressable
                        onPress={() => decCount(l.lineId)}
                        className="h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white active:bg-slate-50"
                      >
                        <Text className="text-base font-semibold">-</Text>
                      </Pressable>
                      <Text className="w-7 text-center font-semibold">{l.qty}</Text>
                      <Pressable
                        onPress={() => incCount(l.lineId)}
                        className="h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white active:bg-slate-50"
                      >
                        <Text className="text-base font-semibold">+</Text>
                      </Pressable>
                      <Text className="w-16 text-right font-semibold">{fmt(total)}</Text>
                      <Pressable onPress={() => removeLine(l.lineId)} hitSlop={8}>
                        <Text className="ml-1 text-sm text-red-600">×</Text>
                      </Pressable>
                    </View>
                  </Card>
                );
              }
              return (
                <Card key={l.lineId} className="mb-2 flex-row items-center justify-between">
                  <Pressable onPress={() => editWeighedLine(l)} className="flex-1 pr-2">
                    <Text className="font-semibold" numberOfLines={1}>{l.name}</Text>
                    <Text className="text-xs text-slate-500">
                      {l.weight.toFixed(3)} {l.weightUnit} × {fmt(l.pricePerUnitCents)}/{l.weightUnit}
                    </Text>
                    <Text className="text-[10px] text-slate-400">Tap to edit weight</Text>
                  </Pressable>
                  <View className="flex-row items-center gap-2">
                    <Text className="w-20 text-right font-semibold">{fmt(total)}</Text>
                    <Pressable onPress={() => removeLine(l.lineId)} hitSlop={8}>
                      <Text className="ml-1 text-sm text-red-600">×</Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Totals */}
        <View className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
          <View className="flex-row justify-between">
            <Text className="text-sm text-slate-500">Subtotal</Text>
            <Text className="text-sm text-slate-600">{fmt(subtotal)}</Text>
          </View>
          {taxAmt > 0 ? (
            <View className="mt-1 flex-row justify-between">
              <Text className="text-sm text-slate-500">
                Tax{tax.ratePct ? ` (${tax.ratePct}%)` : ""}
              </Text>
              <Text className="text-sm text-slate-600">{fmt(taxAmt)}</Text>
            </View>
          ) : null}
          <View className="mt-2 flex-row justify-between border-t border-slate-200 pt-2">
            <Text className="text-lg font-bold">Total</Text>
            <Text className="text-lg font-bold">{fmt(grandTotal)}</Text>
          </View>
        </View>

        {/* Payment selector */}
        <View className="mb-3">
          <Text className="mb-2 text-sm font-semibold text-slate-500">Payment</Text>
          <View className="flex-row flex-wrap gap-2">
            {(["cash", "card", ...(upi ? (["upi"] as const) : [])] as const).map((t) => {
              const sel = payType === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setPayType(t)}
                  className="flex-1 items-center rounded-xl border py-2"
                  style={{ backgroundColor: sel ? brand : "#ffffff", borderColor: sel ? brand : "#e2e8f0" }}
                >
                  <Text className="text-sm font-semibold capitalize" style={{ color: sel ? "#ffffff" : "#475569" }}>
                    {t === "upi" ? "UPI" : t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Button
          label={charge.isPending ? "Processing…" : `Charge ${fmt(grandTotal)}`}
          size="lg"
          style={{ backgroundColor: brand }}
          disabled={chargeDisabled}
          onPress={onChargePress}
        />
        <Button
          label="Clear"
          variant="ghost"
          className="mt-2"
          onPress={() => { setLines([]); setQuery(""); refocusScan(); }}
        />
      </ScrollView>

      {/* Weighed-item prompt */}
      <Modal
        visible={weighedPrompt !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setWeighedPrompt(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
        <Pressable onPress={() => setWeighedPrompt(null)} className="flex-1 bg-slate-900/40" />
        <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white">
          <View className="flex-row items-center justify-between border-b border-slate-100 px-5 py-4">
            <Text className="text-lg font-bold">
              {weighedPrompt?.mode === "edit" ? "Edit weight" : "Weigh item"}
            </Text>
            <Pressable onPress={() => setWeighedPrompt(null)} hitSlop={8}>
              <Text className="text-sm font-medium text-brand-600">Cancel</Text>
            </Pressable>
          </View>
          {weighedPrompt ? (() => {
            const wp = weighedPrompt;
            const wpName = wp.mode === "add" ? wp.item.name : wp.name;
            const wpPpu = wp.mode === "add" ? wp.item.price_cents : wp.pricePerUnitCents;
            const wpUnit = wp.mode === "add" ? (wp.item.weight_unit || "kg") : wp.weightUnit;
            const wNum = parseFloat(weightInput);
            const previewCents = Number.isFinite(wNum) && wNum > 0 ? Math.round(wpPpu * wNum) : 0;
            return (
              <View className="px-5 py-6">
                <Text className="text-base font-semibold">{wpName}</Text>
                <Text className="mt-1 text-xs text-slate-500">{fmt(wpPpu)}/{wpUnit}</Text>
                <View className="mt-4 flex-row items-center gap-2">
                  <Text className="text-sm text-slate-500">Weight</Text>
                  <TextInput
                    value={weightInput}
                    onChangeText={setWeightInput}
                    keyboardType="decimal-pad"
                    placeholder="0.000"
                    autoFocus
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base"
                  />
                  <Text className="text-sm text-slate-500">{wpUnit}</Text>
                </View>
                <Text className="mt-3 text-sm text-slate-500">
                  Price preview:{" "}
                  <Text className="font-semibold text-slate-800">{fmt(previewCents)}</Text>
                </Text>
                <Button
                  label={wp.mode === "edit" ? "Update" : "Add to cart"}
                  size="lg"
                  className="mt-5"
                  style={{ backgroundColor: brand }}
                  onPress={confirmWeighed}
                />
              </View>
            );
          })() : null}
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Quick-add unknown barcode */}
      <Modal
        visible={quickAdd !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setQuickAdd(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
        <Pressable
          onPress={() => { setQuickAdd(null); refocusScan(); }}
          className="flex-1 bg-slate-900/40"
        />
        <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white">
          <View className="flex-row items-center justify-between border-b border-slate-100 px-5 py-4">
            <Text className="text-lg font-bold">Unknown barcode</Text>
            <Pressable
              onPress={() => { setQuickAdd(null); refocusScan(); }}
              hitSlop={8}
            >
              <Text className="text-sm font-medium text-brand-600">Cancel</Text>
            </Pressable>
          </View>
          {quickAdd ? (
            <View className="px-5 py-5">
              <Text className="text-sm text-slate-500">
                Add this item to your catalog so it&apos;s recognised next time.
              </Text>
              <View className="mt-4">
                <Text className="mb-1 text-xs font-semibold text-slate-500">Barcode</Text>
                <TextInput
                  value={quickAdd.barcode}
                  editable={false}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                />
              </View>
              <View className="mt-3">
                <Text className="mb-1 text-xs font-semibold text-slate-500">Name</Text>
                <TextInput
                  value={qaName}
                  onChangeText={setQaName}
                  placeholder="Item name"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </View>
              <View className="mt-3">
                <Text className="mb-1 text-xs font-semibold text-slate-500">Price ($)</Text>
                <TextInput
                  value={qaPrice}
                  onChangeText={setQaPrice}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </View>
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-slate-600">Sold by weight</Text>
                <Switch value={qaSoldByWeight} onValueChange={setQaSoldByWeight} />
              </View>
              {qaSoldByWeight ? (
                <View className="mt-3">
                  <Text className="mb-1 text-xs font-semibold text-slate-500">Weight unit</Text>
                  <TextInput
                    value={qaWeightUnit}
                    onChangeText={setQaWeightUnit}
                    placeholder="kg"
                    autoCapitalize="none"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </View>
              ) : null}
              <Button
                label="Save & add"
                size="lg"
                className="mt-5"
                style={{ backgroundColor: brand }}
                onPress={saveQuickAdd}
              />
            </View>
          ) : null}
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* UPI scan-to-pay — same pattern as the POS */}
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
                  Customer scans with any UPI app. Confirm once their payment succeeds.
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

      {/* Email receipt modal — opened from the post-sale confirmation banner. */}
      <Modal visible={emailModal} animationType="fade" transparent onRequestClose={() => setEmailModal(false)}>
        <Pressable onPress={() => setEmailModal(false)} className="flex-1 items-center justify-center bg-slate-900/40 px-6">
          <Pressable className="w-full max-w-md rounded-2xl bg-white p-5">
            <Text className="mb-3 text-lg font-bold">Email receipt</Text>
            <TextInput
              value={emailDraft}
              onChangeText={setEmailDraft}
              placeholder="customer@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {emailMsg ? (
              <Text className={`mt-2 text-sm ${emailMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{emailMsg.text}</Text>
            ) : null}
            <View className="mt-4 flex-row justify-end gap-2">
              <Pressable onPress={() => setEmailModal(false)} className="rounded-lg px-3 py-2">
                <Text className="text-sm font-semibold text-slate-500">Close</Text>
              </Pressable>
              <Pressable
                disabled={emailSending || !lastOrderId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailDraft.trim())}
                onPress={async () => {
                  if (!lastOrderId) return;
                  setEmailSending(true);
                  setEmailMsg(null);
                  const r = await sendReceiptEmail({ orderId: lastOrderId, email: emailDraft.trim() });
                  setEmailSending(false);
                  if (r.ok) {
                    setEmailMsg({ ok: true, text: "Sent." });
                    setTimeout(() => setEmailModal(false), 800);
                  } else {
                    setEmailMsg({ ok: false, text: r.error });
                  }
                }}
                className="rounded-lg px-3 py-2"
                style={{ backgroundColor: brand, opacity: emailSending ? 0.5 : 1 }}
              >
                <Text className="text-sm font-semibold text-white">{emailSending ? "Sending…" : "Send"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* SMS receipt modal — opened from the post-sale confirmation banner. */}
      <Modal visible={smsModal} animationType="fade" transparent onRequestClose={() => setSmsModal(false)}>
        <Pressable onPress={() => setSmsModal(false)} className="flex-1 items-center justify-center bg-slate-900/40 px-6">
          <Pressable className="w-full max-w-md rounded-2xl bg-white p-5">
            <Text className="mb-3 text-lg font-bold">SMS receipt</Text>
            <TextInput
              value={smsDraft}
              onChangeText={setSmsDraft}
              placeholder="+15551234567"
              autoCapitalize="none"
              keyboardType="phone-pad"
              autoFocus
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {smsMsg ? (
              <Text className={`mt-2 text-sm ${smsMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{smsMsg.text}</Text>
            ) : null}
            <View className="mt-4 flex-row justify-end gap-2">
              <Pressable onPress={() => setSmsModal(false)} className="rounded-lg px-3 py-2">
                <Text className="text-sm font-semibold text-slate-500">Close</Text>
              </Pressable>
              <Pressable
                disabled={smsSending || !lastOrderId || !/^\+?[1-9]\d{6,15}$/.test(smsDraft.replace(/[\s\-()]/g, ""))}
                onPress={async () => {
                  if (!lastOrderId) return;
                  setSmsSending(true);
                  setSmsMsg(null);
                  const r = await sendReceiptSms({ orderId: lastOrderId, phone: smsDraft.trim() });
                  setSmsSending(false);
                  if (r.ok) {
                    setSmsMsg({ ok: true, text: "Sent." });
                    setTimeout(() => setSmsModal(false), 800);
                  } else {
                    setSmsMsg({ ok: false, text: r.error });
                  }
                }}
                className="rounded-lg px-3 py-2"
                style={{ backgroundColor: brand, opacity: smsSending ? 0.5 : 1 }}
              >
                <Text className="text-sm font-semibold text-white">{smsSending ? "Sending…" : "Send"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
