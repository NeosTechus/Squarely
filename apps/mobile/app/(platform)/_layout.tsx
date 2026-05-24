import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useSegments } from "expo-router";
import { PlatformDrawerProvider, useDrawerStore } from "@/components/PlatformDrawer";

const TITLES: Record<string, string> = {
  index: "Overview",
  clients: "Clients",
  analytics: "Analytics",
  revenue: "Revenue & health",
  plans: "Plans",
  announcements: "Announcements",
  admins: "Platform admins",
  audit: "Audit log",
  client: "Client",
  "new-client": "New client",
};

function PlatformHeader() {
  const open = useDrawerStore((s) => s.open);
  const segments = useSegments();
  const last = segments[segments.length - 1] ?? "index";
  const key = last === "(platform)" ? "index" : last;
  const title = TITLES[key] ?? "Platform";

  return (
    <View className="border-b border-slate-200 bg-white">
      <SafeAreaView edges={["top"]}>
        <View className="h-14 flex-row items-center px-2">
          <Pressable onPress={open} hitSlop={16} className="h-10 w-12 items-center justify-center">
            <Text className="text-2xl leading-none">☰</Text>
          </Pressable>
          <Text className="flex-1 text-center text-base font-semibold text-slate-900">{title}</Text>
          <View className="w-12" />
        </View>
      </SafeAreaView>
    </View>
  );
}

export default function PlatformLayout() {
  return (
    <PlatformDrawerProvider>
      <View className="flex-1">
        <PlatformHeader />
        <View className="flex-1">
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </View>
    </PlatformDrawerProvider>
  );
}
