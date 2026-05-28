import { View, Text } from "react-native";

export interface ReceiptLine {
  name: string;
  qty: number;
  unitCents: number;
}
export interface ReceiptData {
  storeName: string;
  orderNumber: number;
  createdAt?: string;
  lines: ReceiptLine[];
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  paymentLabel?: string;
}

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Presentational receipt — shared by POS and Kiosk. */
export function Receipt({ data }: { data: ReceiptData }) {
  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-5">
      <View className="items-center border-b border-dashed border-slate-200 pb-3">
        <Text className="text-lg font-bold tracking-tight">{data.storeName}</Text>
        <Text className="mt-1 text-sm text-slate-500">Order #{data.orderNumber}</Text>
        {data.createdAt ? (
          <Text className="text-xs text-slate-400">{new Date(data.createdAt).toLocaleString()}</Text>
        ) : null}
      </View>

      <View className="gap-1.5 border-b border-dashed border-slate-200 py-3">
        {data.lines.map((l, i) => (
          <View key={i} className="flex-row justify-between">
            <Text className="flex-1 pr-2 text-sm text-slate-700">{l.qty} × {l.name}</Text>
            <Text className="text-sm text-slate-700">{fmt(l.unitCents * l.qty)}</Text>
          </View>
        ))}
      </View>

      <View className="gap-1 pt-3">
        <Row label="Subtotal" value={fmt(data.subtotalCents)} />
        {data.taxCents > 0 ? <Row label="Tax" value={fmt(data.taxCents)} /> : null}
        {data.tipCents > 0 ? <Row label="Tip" value={fmt(data.tipCents)} /> : null}
        <View className="mt-1 flex-row justify-between border-t border-slate-200 pt-2">
          <Text className="text-base font-bold">Total</Text>
          <Text className="text-base font-bold">{fmt(data.totalCents)}</Text>
        </View>
        {data.paymentLabel ? (
          <Text className="mt-1 text-center text-xs uppercase tracking-wide text-slate-400">{data.paymentLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-sm text-slate-500">{label}</Text>
      <Text className="text-sm text-slate-600">{value}</Text>
    </View>
  );
}
