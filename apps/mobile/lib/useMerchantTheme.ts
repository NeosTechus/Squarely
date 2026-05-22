import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useActiveMerchant } from "./useActiveMerchant";

const DEFAULT_BRAND = "#4f46e5";

/** The merchant's brand color, applied to POS/Kiosk customer-facing UI. */
export function useMerchantTheme() {
  const { data: merchantId } = useActiveMerchant();
  const { data } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["merchant-theme", merchantId],
    queryFn: async (): Promise<string> => {
      const { data, error } = await (supabase as any)
        .from("merchants")
        .select("brand_color")
        .eq("id", merchantId)
        .maybeSingle();
      if (error) throw error;
      return (data?.brand_color as string) || DEFAULT_BRAND;
    },
  });
  return data ?? DEFAULT_BRAND;
}
