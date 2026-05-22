import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useActiveMerchant } from "./useActiveMerchant";

export interface MerchantFeatures {
  pos: boolean;
  kiosk: boolean;
  kds: boolean;
  admin: boolean;
}

const DEFAULTS: MerchantFeatures = { pos: true, kiosk: true, kds: true, admin: true };

/** Per-merchant feature switches set by the platform super-admin. */
export function useMerchantFeatures() {
  const { data: merchantId } = useActiveMerchant();
  return useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["merchant-features", merchantId],
    queryFn: async (): Promise<MerchantFeatures> => {
      const { data, error } = await (supabase as any)
        .from("merchant_features")
        .select("pos, kiosk, kds, admin")
        .eq("merchant_id", merchantId)
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULTS, ...(data ?? {}) };
    },
  });
}
