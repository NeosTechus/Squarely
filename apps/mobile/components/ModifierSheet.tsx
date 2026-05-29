import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, ActivityIndicator } from "react-native";
import { useItemModifiers } from "@/lib/useItemModifiers";

export interface SelectedModifier {
  id: string;
  name: string;
  price_delta_cents: number;
  group_id: string;
}

const fmt = (c: number) => `${c < 0 ? "-" : "+"}$${(Math.abs(c) / 100).toFixed(2)}`;

/**
 * Bottom-sheet modifier picker. Shown when adding an item that has modifier
 * groups. Honors `required` and `max_select`. Calls onConfirm with the chosen
 * options (which carry their price deltas) so the caller can add to the cart.
 */
export function ModifierSheet({
  visible,
  item,
  brand,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  item: { id: string; name: string; price_cents: number; modifier_group_ids: string[] | null } | null;
  brand: string;
  onClose: () => void;
  onConfirm: (mods: SelectedModifier[]) => void;
}) {
  const { data: groups = [], isLoading } = useItemModifiers(item?.modifier_group_ids);
  const [selected, setSelected] = useState<Record<string, SelectedModifier[]>>({});

  // reset selection whenever a new item opens
  const itemId = item?.id;
  useEffect(() => setSelected({}), [itemId]);

  const toggle = (g: { id: string; max_select: number }, opt: SelectedModifier) => {
    setSelected((prev) => {
      const cur = prev[g.id] ?? [];
      const has = cur.some((o) => o.id === opt.id);
      let next: SelectedModifier[];
      if (has) next = cur.filter((o) => o.id !== opt.id);
      else if (g.max_select <= 1) next = [opt];
      else if (cur.length < g.max_select) next = [...cur, opt];
      else next = cur; // at max, ignore
      return { ...prev, [g.id]: next };
    });
  };

  const flat = Object.values(selected).flat();
  const delta = flat.reduce((s, o) => s + o.price_delta_cents, 0);
  const total = (item?.price_cents ?? 0) + delta;
  const missingRequired = groups.some((g) => g.required && (selected[g.id]?.length ?? 0) === 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-slate-900/40" />
      <View className="absolute bottom-0 left-0 right-0 max-h-[80%] rounded-t-3xl bg-white">
        <View className="flex-row items-center justify-between border-b border-slate-100 px-5 py-4">
          <Text className="text-lg font-bold" numberOfLines={1}>{item?.name}</Text>
          <Pressable onPress={onClose} hitSlop={8}><Text className="text-sm font-medium text-slate-500">Close</Text></Pressable>
        </View>

        <ScrollView className="px-5" contentContainerStyle={{ paddingVertical: 12 }}>
          {isLoading ? <ActivityIndicator className="mt-6" /> : null}
          {groups.map((g) => {
            const cur = selected[g.id] ?? [];
            return (
              <View key={g.id} className="mb-5">
                <View className="mb-2 flex-row items-center gap-2">
                  <Text className="text-base font-semibold text-slate-800">{g.name}</Text>
                  {g.required ? <Text className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">Required</Text> : null}
                  {g.max_select > 1 ? <Text className="text-xs text-slate-400">choose up to {g.max_select}</Text> : null}
                </View>
                {g.options.map((o) => {
                  const on = cur.some((s) => s.id === o.id);
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => toggle(g, { id: o.id, name: o.name, price_delta_cents: o.price_delta_cents, group_id: g.id })}
                      className={`mb-2 flex-row items-center justify-between rounded-xl border px-4 py-3 ${on ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}
                    >
                      <Text className="text-slate-700">{o.name}</Text>
                      <View className="flex-row items-center gap-3">
                        {o.price_delta_cents !== 0 ? <Text className="text-sm text-slate-500">{fmt(o.price_delta_cents)}</Text> : null}
                        <View className={`h-5 w-5 items-center justify-center rounded-full border ${on ? "border-brand-600" : "border-slate-300"}`} style={on ? { backgroundColor: brand } : undefined}>
                          {on ? <Text className="text-xs text-white">✓</Text> : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>

        <View className="border-t border-slate-100 p-4">
          <Pressable
            onPress={() => { onConfirm(flat); onClose(); }}
            disabled={missingRequired}
            className="items-center rounded-2xl py-4 active:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: brand }}
          >
            <Text className="text-base font-bold text-white">
              {missingRequired ? "Select required options" : `Add · $${(total / 100).toFixed(2)}`}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
