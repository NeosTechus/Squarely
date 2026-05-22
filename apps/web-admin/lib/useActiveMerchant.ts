"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";

/** Resolves the signed-in user's active merchant id (JWT claim, with membership fallback). */
export function useActiveMerchant() {
  return useQuery({
    queryKey: ["active-merchant"],
    queryFn: async (): Promise<string | null> => {
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
