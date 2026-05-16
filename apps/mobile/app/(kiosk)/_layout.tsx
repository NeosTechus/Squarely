import { Stack } from "expo-router";

export default function KioskLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false, animation: "fade" }} />
  );
}
