import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useActiveMerchant } from "./useActiveMerchant";

export interface KioskConfig {
  imageUrl: string | null;
  headline: string;
  subtext: string;
}

const DEFAULTS: KioskConfig = {
  imageUrl: null,
  headline: "Welcome",
  subtext: "Tap anywhere to start your order",
};

/** Owner-customized kiosk landing screen (image + headline + subtext). */
export function useKioskConfig() {
  const { data: merchantId } = useActiveMerchant();
  const { data } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["kiosk-config", merchantId],
    queryFn: async (): Promise<KioskConfig> => {
      const { data, error } = await (supabase as any)
        .from("merchants")
        .select("kiosk_image_url, kiosk_headline, kiosk_subtext")
        .eq("id", merchantId)
        .maybeSingle();
      if (error) throw error;
      return {
        imageUrl: data?.kiosk_image_url ?? null,
        headline: data?.kiosk_headline || DEFAULTS.headline,
        subtext: data?.kiosk_subtext || DEFAULTS.subtext,
      };
    },
  });
  return data ?? DEFAULTS;
}
