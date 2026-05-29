import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useActiveMerchant } from "./useActiveMerchant";

/**
 * The active merchant's sales-tax rate in basis points (e.g. 825 = 8.25%),
 * resolved from the store's state + city via resolve_tax_bps(). A non-zero
 * merchants.tax_rate_bps acts as a manual override.
 */
export function useMerchantTax() {
  const { data: merchantId } = useActiveMerchant();
  const { data: bps = 0 } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["merchant-tax", merchantId],
    queryFn: async (): Promise<number> => {
      const { data: m } = await (supabase as any)
        .from("merchants")
        .select("tax_rate_bps, region, city")
        .eq("id", merchantId)
        .maybeSingle();
      const override = Number(m?.tax_rate_bps ?? 0);
      if (override > 0) return override;
      const { data: resolved } = await (supabase as any).rpc("resolve_tax_bps", {
        p_state: m?.region ?? null,
        p_city: m?.city ?? null,
      });
      return Number(resolved ?? 0);
    },
  });
  return {
    bps,
    ratePct: bps / 100,
    taxCents: (subtotalCents: number) => Math.round((subtotalCents * bps) / 10000),
  };
}
