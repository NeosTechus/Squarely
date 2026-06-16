import { useEffect } from "react";
import { BackHandler } from "react-native";
import { Stack } from "expo-router";
import { PasscodeLock } from "@/components/PasscodeLock";

export default function KdsLayout() {
  // Kitchen tablet lockdown: swallow the Android hardware Back button (and the
  // system Back gesture in 3-button nav mode) for the entire (kds) route group.
  // A stray Back press on an unattended kitchen tablet would pop the navigator
  // off the orders board mid-service. `gestureEnabled:false` on the Stack only
  // blocks the in-app swipe-back — it does NOT cover the hardware key, so we
  // need both. Mirrors the (kiosk) layout pattern.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
      <PasscodeLock />
    </>
  );
}
