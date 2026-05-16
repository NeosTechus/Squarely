import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@squarely/ui-mobile";
import type { BootMode } from "@squarely/types";
import { useBootMode } from "@/store/boot";

interface ModeOption {
  mode: BootMode;
  title: string;
  body: string;
  emoji: string;
  requiresFeature?: "kiosk" | "kds";
}

const options: ModeOption[] = [
  { mode: "pos", title: "Point of Sale", body: "Ring up customers. Cart, modifiers, payments, receipts.", emoji: "🧾" },
  { mode: "kiosk", title: "Self-Order Kiosk", body: "Customer-facing locked-down ordering screen.", emoji: "🖥️", requiresFeature: "kiosk" },
  { mode: "kds", title: "Kitchen Display", body: "See orders the moment they're placed. Mark ready.", emoji: "👨‍🍳", requiresFeature: "kds" },
  { mode: "admin", title: "Admin", body: "Reports, inventory, customers, devices.", emoji: "📊" },
];

export default function BootPicker() {
  const setMode = useBootMode((s) => s.setMode);

  const pick = (mode: BootMode) => {
    setMode(mode);
    router.replace(`/(${mode})` as never);
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text className="text-3xl font-bold tracking-tight">Pick a mode</Text>
        <Text className="mt-2 text-slate-600">
          This device will boot into this mode every time. Change later in Settings.
        </Text>
        <View className="mt-8 gap-4">
          {options.map((o) => (
            <Pressable
              key={o.mode}
              onPress={() => pick(o.mode)}
              className="flex-row items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 active:bg-slate-50"
            >
              <Text className="text-4xl">{o.emoji}</Text>
              <View className="flex-1">
                <Text className="text-lg font-semibold">{o.title}</Text>
                <Text className="mt-1 text-sm text-slate-600">{o.body}</Text>
                {o.requiresFeature ? (
                  <Text className="mt-1 text-xs text-slate-400">
                    Available on Growth and above
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
