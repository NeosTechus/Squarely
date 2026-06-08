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
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let hidden = false;
    const hide = () => {
      if (hidden) return;
      hidden = true;
      SplashScreen.hideAsync().catch(() => {});
    };
    // Watchdog: if AsyncStorage stalls (slow Android cold start, corrupted
    // mmkv, etc.) we still want to drop the splash within a bounded window so
    // the user sees the auth screen rather than an indefinitely frozen logo.
    watchdog = setTimeout(hide, 6000);
    (async () => {
      try {
        await Promise.all([hydrate(), hydrateImpersonation()]);
      } finally {
        if (watchdog) clearTimeout(watchdog);
        hide();
      }
    })();
    return () => {
      if (watchdog) clearTimeout(watchdog);
    };
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
