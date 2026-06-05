import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { Providers } from "@/components/Providers";
import { useBootMode } from "@/store/boot";
import { useImpersonation } from "@/lib/impersonation";

// Keep the branded splash up until our two AsyncStorage hydrations finish, so
// cold start shows the splash instead of flashing a blank screen / spinner.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const hydrate = useBootMode((s) => s.hydrate);
  const hydrateImpersonation = useImpersonation((s) => s.hydrate);
  useEffect(() => {
    (async () => {
      try {
        await Promise.all([hydrate(), hydrateImpersonation()]);
      } finally {
        SplashScreen.hideAsync().catch(() => {});
      }
    })();
  }, [hydrate, hydrateImpersonation]);
  return (
    <Providers>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(boot)" />
        <Stack.Screen name="(pos)" />
        <Stack.Screen name="(register)" />
        <Stack.Screen name="(kiosk)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(kds)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(platform)" />
      </Stack>
    </Providers>
  );
}
