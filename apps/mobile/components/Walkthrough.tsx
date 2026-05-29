import { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMerchantTheme } from "@/lib/useMerchantTheme";

const STORAGE_KEY = "squarely:onboarded";

interface Slide {
  emoji: string;
  title: string;
  body: string;
}

const slides: Slide[] = [
  { emoji: "👋", title: "Welcome to Squarely", body: "Run your whole business from one app." },
  { emoji: "🧾", title: "Point of Sale", body: "Ring up customers, take cash/card/split, print receipts." },
  { emoji: "🖥️", title: "Self-order Kiosk", body: "Let customers order themselves; orders go to the kitchen." },
  { emoji: "👨‍🍳", title: "Kitchen Display", body: "See and advance orders live as they come in." },
  { emoji: "📊", title: "Admin", body: "Sales, inventory, customers, and reports at a glance." },
];

interface WalkthroughProps {
  /** Called after the user finishes or skips the walkthrough. */
  onDone?: () => void;
}

/**
 * One-time, graphical first-run walkthrough. Self-manages its visibility:
 * reads `squarely:onboarded` on mount and renders nothing if already done.
 * On finish/skip it persists the flag and calls `onDone`.
 */
export function Walkthrough({ onDone }: WalkthroughProps) {
  const brand = useMerchantTheme();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [checked, setChecked] = useState(false);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (!active) return;
        setVisible(v == null);
        setChecked(true);
      })
      .catch(() => {
        if (!active) return;
        // On read failure, fail open and show the walkthrough.
        setVisible(true);
        setChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const finish = () => {
    setVisible(false);
    AsyncStorage.setItem(STORAGE_KEY, "1").catch(() => {});
    onDone?.();
  };

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, i));
    setIndex(clamped);
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  // Haven't read the flag yet — render nothing to avoid a flash.
  if (!checked) return null;
  if (!visible) return null;

  const isLast = index === slides.length - 1;

  return (
    <Modal visible animationType="fade" onRequestClose={finish}>
      <SafeAreaView className="flex-1 bg-white">
        {/* Skip */}
        <View className="flex-row justify-end px-5 pt-2">
          <Pressable onPress={finish} hitSlop={12} className="px-2 py-1">
            <Text className="text-base font-medium text-slate-400">Skip</Text>
          </Pressable>
        </View>

        {/* Pager */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          className="flex-1"
        >
          {slides.map((s) => (
            <View key={s.title} style={{ width }} className="flex-1 items-center justify-center px-10">
              <Text className="text-8xl">{s.emoji}</Text>
              <Text className="mt-10 text-center text-3xl font-bold tracking-tight text-slate-900">
                {s.title}
              </Text>
              <Text className="mt-4 text-center text-lg leading-6 text-slate-600">{s.body}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Page dots */}
        <View className="flex-row items-center justify-center gap-2 py-4">
          {slides.map((s, i) => (
            <Pressable
              key={s.title}
              onPress={() => goTo(i)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Go to slide ${i + 1}`}
            >
              <View
                className="h-2 rounded-full"
                style={{
                  width: i === index ? 20 : 8,
                  backgroundColor: i === index ? brand : "#cbd5e1",
                }}
              />
            </Pressable>
          ))}
        </View>

        {/* Controls */}
        <View className="flex-row items-center gap-3 px-6 pb-6 pt-2">
          {index > 0 ? (
            <Pressable
              onPress={() => goTo(index - 1)}
              className="rounded-2xl border border-slate-200 px-6 py-4 active:bg-slate-50"
            >
              <Text className="text-base font-semibold text-slate-700">Back</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => (isLast ? finish() : goTo(index + 1))}
            style={{ backgroundColor: brand }}
            className="flex-1 items-center rounded-2xl px-6 py-4 active:opacity-90"
          >
            <Text className="text-base font-semibold text-white">{isLast ? "Get started" : "Next"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
