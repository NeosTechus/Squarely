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

  if (!hydrated || isLoading || (session && checkingAdmin)) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;

  // Super admins go straight to the platform console (no merchant boot picker).
  if (isPlatformAdmin) return <Redirect href={"/(platform)" as never} />;

  if (!mode) return <Redirect href="/(boot)" />;

  switch (mode) {
    case "pos":
      return <Redirect href="/(pos)" />;
    case "kiosk":
      return <Redirect href="/(kiosk)" />;
    case "kds":
      return <Redirect href="/(kds)" />;
    case "admin":
      return <Redirect href="/(admin)" />;
    default:
      return <Redirect href="/(boot)" />;
  }
}
