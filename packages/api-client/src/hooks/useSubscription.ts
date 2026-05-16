import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { qk } from "../keys";

export function useActiveSubscription(supabase: SupabaseClient, merchantId: string | null) {
  return useQuery({
    enabled: Boolean(merchantId),
    queryKey: qk.subscription(merchantId ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, plan:plans(*)")
        .eq("merchant_id", merchantId)
        .in("status", ["trialing", "active"])
        .order("current_period_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}
