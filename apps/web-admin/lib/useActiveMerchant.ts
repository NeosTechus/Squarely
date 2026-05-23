"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { getImpersonatedMerchant } from "./impersonation";

/** Resolves the active merchant id: a platform admin's "view as" selection,
 *  else the signed-in user's JWT claim, with membership fallback. */
export function useActiveMerchant() {
  const impersonated = getImpersonatedMerchant();
  return useQuery({
    queryKey: ["active-merchant", impersonated],
    queryFn: async (): Promise<string | null> => {
      if (impersonated) return impersonated;

      const supabase = createBrowserClient();
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return null;

      const claim = (session.user.app_metadata as Record<string, unknown> | undefined)
        ?.active_merchant_id;
      if (typeof claim === "string" && claim) return claim;

      const { data: member } = await supabase
        .from("merchant_members")
        .select("merchant_id")
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      return (member as { merchant_id?: string } | null)?.merchant_id ?? null;
    },
  });
}
