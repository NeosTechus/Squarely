import { useEffect } from "react";
import { BackHandler } from "react-native";
import { Stack } from "expo-router";
import { PasscodeLock } from "@/components/PasscodeLock";

export default function KioskLayout() {
  // Kiosk lockdown: swallow the Android hardware Back button (and system Back
  // gesture in 3-button mode) for the entire kiosk route group. Without this,
  // a customer pressing Back can pop the navigator and escape the kiosk
  // mid-order. `gestureEnabled:false` on the Stack only blocks the in-app
  // swipe-back gesture — it does NOT cover the hardware key.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false, animation: "fade" }} />
      <PasscodeLock />
    </>
  );
}
