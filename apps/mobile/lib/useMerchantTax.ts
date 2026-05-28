import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useActiveMerchant } from "./useActiveMerchant";

/**
 * The active merchant's sales-tax rate in basis points (e.g. 825 = 8.25%).
 * Use `taxCents(subtotal)` to compute tax on a subtotal.
 */
export function useMerchantTax() {
  const { data: merchantId } = useActiveMerchant();
  const { data: bps = 0 } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["merchant-tax", merchantId],
    queryFn: async (): Promise<number> => {
      const { data, error } = await (supabase as any)
        .from("merchants")
        .select("tax_rate_bps")
        .eq("id", merchantId)
        .maybeSingle();
      if (error) throw error;
      return Number(data?.tax_rate_bps ?? 0);
    },
  });
  return {
    bps,
    ratePct: bps / 100,
    taxCents: (subtotalCents: number) => Math.round((subtotalCents * bps) / 10000),
  };
}
