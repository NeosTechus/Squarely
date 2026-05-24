import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useImpersonation } from "@/lib/impersonation";

/** Shows when a platform admin is "viewing as" a client. Tap Exit to return. */
export function ImpersonationBanner() {
  const qc = useQueryClient();
  const { merchantId, merchantName, stop } = useImpersonation();
  if (!merchantId) return null;

  const exit = () => {
    stop();
    qc.clear();
    router.replace("/(platform)" as never);
  };

  return (
    <View className="flex-row items-center justify-between bg-amber-500 px-4 py-2">
      <Text className="flex-1 text-sm font-medium text-white" numberOfLines={1}>
        Viewing as {merchantName ?? "client"}
      </Text>
      <Pressable onPress={exit} hitSlop={8} className="rounded-md bg-white/20 px-3 py-1 active:bg-white/30">
        <Text className="text-sm font-semibold text-white">Exit</Text>
      </Pressable>
    </View>
  );
}
