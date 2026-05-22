import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

/**
 * Resolves the signed-in user's active merchant id.
 * Reads the `active_merchant_id` JWT claim if present, otherwise falls back
 * to the user's first active membership.
 */
export function useActiveMerchant() {
  return useQuery({
    queryKey: ["active-merchant"],
    queryFn: async (): Promise<string | null> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) return null;

      const claim = (session.user.app_metadata as Record<string, unknown> | undefined)
        ?.active_merchant_id;
      if (typeof claim === "string" && claim) return claim;

      const { data, error } = await supabase
        .from("merchant_members")
        .select("merchant_id")
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as { merchant_id?: string } | null)?.merchant_id ?? null;
    },
  });
}
