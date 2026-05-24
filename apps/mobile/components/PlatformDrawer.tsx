import { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, Dimensions, ScrollView, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useSegments } from "expo-router";
import { create } from "zustand";
import { supabase } from "@/lib/supabase";

const WIDTH = Math.min(300, Dimensions.get("window").width * 0.82);

/** Drawer open-state lives in a store so the hamburger works regardless of
 * where it is rendered (the native stack header is outside React context). */
interface DrawerState {
  visible: boolean;
  open: () => void;
  close: () => void;
}
export const useDrawerStore = create<DrawerState>((set) => ({
  visible: false,
  open: () => set({ visible: true }),
  close: () => set({ visible: false }),
}));

const NAV = [
  { key: "index", label: "Overview", emoji: "📊", href: "/(platform)" },
  { key: "clients", label: "Clients", emoji: "🏪", href: "/(platform)/clients" },
  { key: "analytics", label: "Analytics", emoji: "📈", href: "/(platform)/analytics" },
  { key: "revenue", label: "Revenue & health", emoji: "💰", href: "/(platform)/revenue" },
  { key: "plans", label: "Plans", emoji: "📦", href: "/(platform)/plans" },
  { key: "announcements", label: "Announcements", emoji: "📣", href: "/(platform)/announcements" },
  { key: "admins", label: "Platform admins", emoji: "🛡️", href: "/(platform)/admins" },
  { key: "audit", label: "Audit log", emoji: "🧾", href: "/(platform)/audit" },
] as const;

/** Hamburger button — place in each screen's headerLeft. */
export function MenuButton() {
  const open = useDrawerStore((s) => s.open);
  return (
    <Pressable onPress={open} hitSlop={16} className="pr-5 pl-1 py-2">
      <Text className="text-2xl leading-none">☰</Text>
    </Pressable>
  );
}

export function PlatformDrawerProvider({ children }: { children: React.ReactNode }) {
  const visible = useDrawerStore((s) => s.visible);
  const setClosed = useDrawerStore((s) => s.close);
  const segments = useSegments();
  const current = segments[segments.length - 1] ?? "index";
  const activeKey = current === "(platform)" ? "index" : current;

  const slide = useRef(new Animated.Value(-WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slide.setValue(-WIDTH);
      fade.setValue(0);
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slide, fade]);

  const close = () => {
    Animated.parallel([
      Animated.timing(slide, { toValue: -WIDTH, duration: 180, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setClosed());
  };

  const go = (href: string) => {
    close();
    setTimeout(() => router.replace(href as never), 190);
  };

  const signOut = async () => {
    setClosed();
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  };

  return (
    <>
      {children}
      <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        <View className="flex-1">
          <Animated.View style={{ opacity: fade }} className="absolute inset-0">
            <Pressable onPress={close} className="flex-1 bg-slate-900/50" />
          </Animated.View>
          <Animated.View
            style={{ width: WIDTH, transform: [{ translateX: slide }] }}
            className="absolute bottom-0 left-0 top-0 bg-white"
          >
            <SafeAreaView edges={["top", "bottom", "left"]} className="flex-1">
              <View className="border-b border-slate-100 px-5 py-4">
                <Text className="text-base font-bold tracking-tight">Squarely</Text>
                <Text className="text-xs text-slate-500">Platform Admin</Text>
              </View>
              <ScrollView className="flex-1 px-3 py-3">
                {NAV.map((item) => {
                  const active = item.key === activeKey;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => go(item.href)}
                      className={`mb-1 flex-row items-center gap-3 rounded-lg px-3 py-3 ${
                        active ? "bg-brand-50" : "active:bg-slate-50"
                      }`}
                    >
                      <Text className="text-lg">{item.emoji}</Text>
                      <Text className={`text-sm font-medium ${active ? "text-brand-700" : "text-slate-700"}`}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View className="border-t border-slate-100 p-3">
                <Pressable onPress={signOut} className="rounded-lg px-3 py-3 active:bg-slate-50">
                  <Text className="text-sm font-medium text-red-600">Sign out</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
