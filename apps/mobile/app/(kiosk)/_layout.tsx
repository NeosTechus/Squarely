import { Stack } from "expo-router";
import { PasscodeLock } from "@/components/PasscodeLock";

export default function KioskLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false, animation: "fade" }} />
      <PasscodeLock />
    </>
  );
}
