import { View, Text, Pressable } from "react-native";
import { ScreenContainer } from "@squarely/ui-mobile";

export default function KioskWelcome() {
  return (
    <ScreenContainer>
      <Pressable
        className="flex-1 items-center justify-center bg-brand-600 active:opacity-95"
        onPress={() => {
          /* Phase 4: advance to order-type picker */
        }}
      >
        <Text className="text-6xl font-bold text-white">Welcome</Text>
        <Text className="mt-4 text-2xl text-brand-50">Tap anywhere to start your order</Text>
      </Pressable>
    </ScreenContainer>
  );
}
