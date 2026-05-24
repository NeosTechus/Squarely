import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Providers } from "@/components/Providers";
import { useBootMode } from "@/store/boot";
import { useImpersonation } from "@/lib/impersonation";

export default function RootLayout() {
  const hydrate = useBootMode((s) => s.hydrate);
  const hydrateImpersonation = useImpersonation((s) => s.hydrate);
  useEffect(() => {
    hydrate();
    hydrateImpersonation();
  }, [hydrate, hydrateImpersonation]);
  return (
    <Providers>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(boot)" />
        <Stack.Screen name="(pos)" />
        <Stack.Screen name="(kiosk)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(kds)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(platform)" />
      </Stack>
    </Providers>
  );
}
