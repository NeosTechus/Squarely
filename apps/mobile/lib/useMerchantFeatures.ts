import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useActiveMerchant } from "./useActiveMerchant";

export interface MerchantFeatures {
  pos: boolean;
  kiosk: boolean;
  kds: boolean;
  admin: boolean;
  email_receipts: boolean;
  print_receipts: boolean;
  sms_receipts: boolean;
  tips_enabled: boolean;
  modifiers_enabled: boolean;
  open_tabs_enabled: boolean;
}

const DEFAULTS: MerchantFeatures = {
  pos: true,
  kiosk: true,
  kds: true,
  admin: true,
  email_receipts: true,
  print_receipts: true,
  sms_receipts: false,
  tips_enabled: true,
  modifiers_enabled: true,
  open_tabs_enabled: true,
};

/** Per-merchant feature switches set by the platform super-admin. */
export function useMerchantFeatures() {
  const { data: merchantId } = useActiveMerchant();
  return useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["merchant-features", merchantId],
    queryFn: async (): Promise<MerchantFeatures> => {
      const { data, error } = await (supabase as any)
        .from("merchant_features")
        .select(
          "pos, kiosk, kds, admin, email_receipts, print_receipts, sms_receipts, tips_enabled, modifiers_enabled, open_tabs_enabled",
        )
        .eq("merchant_id", merchantId)
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULTS, ...(data ?? {}) };
    },
  });
}
