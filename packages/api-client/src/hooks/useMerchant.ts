import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { qk } from "../keys";

export function useMyMerchants(supabase: SupabaseClient) {
  return useQuery({
    queryKey: qk.myMerchants(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_members")
        .select("role, merchants(*)")
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMerchant(supabase: SupabaseClient, merchantId: string | null) {
  return useQuery({
    enabled: Boolean(merchantId),
    queryKey: qk.merchant(merchantId ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("*")
        .eq("id", merchantId)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
