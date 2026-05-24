import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useImpersonation } from "./impersonation";

/**
 * Resolves the signed-in user's active merchant id.
 * If a platform admin is "viewing as" a client, that merchant wins. Otherwise
 * reads the `active_merchant_id` JWT claim, then falls back to the first active
 * membership.
 */
export function useActiveMerchant() {
  const impersonatedId = useImpersonation((s) => s.merchantId);
  return useQuery({
    queryKey: ["active-merchant", impersonatedId],
    queryFn: async (): Promise<string | null> => {
      if (impersonatedId) return impersonatedId;

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
