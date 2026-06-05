import { useEffect } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useBootMode } from "@/store/boot";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { usePlatformAdmin } from "@/lib/usePlatformAdmin";

export default function Index() {
  const { mode, hydrated } = useBootMode();

  const { data: session, isLoading } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: isPlatformAdmin, isLoading: checkingAdmin } = usePlatformAdmin();

  useEffect(() => {
    /* subscribe to auth changes — keep query cache in sync (future) */
  }, []);

  if (!hydrated || isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;

  // Fast path: returning user with a saved boot mode goes straight to it.
  // Skips waiting on the platform-admin lookup — the destination screen still
  // enforces RLS, so this only affects routing speed, not authorization.
  if (mode) {
    switch (mode) {
      case "pos":
        return <Redirect href="/(pos)" />;
      case "kiosk":
        return <Redirect href="/(kiosk)" />;
      case "kds":
        return <Redirect href="/(kds)" />;
      case "admin":
        return <Redirect href="/(admin)" />;
      case "register":
        return <Redirect href={"/(register)" as never} />;
    }
  }

  // First launch / cleared mode: now wait for the platform-admin check so we
  // pick the right entry point (super-admin console vs merchant boot picker).
  if (checkingAdmin) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }
  if (isPlatformAdmin) return <Redirect href={"/(platform)" as never} />;
  return <Redirect href="/(boot)" />;
}
