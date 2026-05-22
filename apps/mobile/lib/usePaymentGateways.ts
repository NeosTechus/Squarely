import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useActiveMerchant } from "./useActiveMerchant";

export interface PaymentGateway {
  provider: string;
  enabled: boolean;
  is_default: boolean;
  config: Record<string, unknown> | null;
}

/** Implicit fallback so the POS can always take a payment. */
const CASH_FALLBACK: PaymentGateway = {
  provider: "cash",
  enabled: true,
  is_default: true,
  config: null,
};

/**
 * The active merchant's enabled payment gateways, ordered with the default
 * first. Falls back to a single implicit cash option when none are configured.
 */
export function usePaymentGateways() {
  const { data: merchantId } = useActiveMerchant();
  return useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["payment-gateways", merchantId],
    queryFn: async (): Promise<PaymentGateway[]> => {
      const { data, error } = await (supabase as any)
        .from("merchant_payment_gateways")
        .select("provider, enabled, is_default, config")
        .eq("merchant_id", merchantId)
        .eq("enabled", true);
      if (error) throw error;

      const gateways = (data ?? []) as PaymentGateway[];
      if (gateways.length === 0) return [CASH_FALLBACK];

      // Default first, then stable order.
      return [...gateways].sort(
        (a, b) => Number(b.is_default) - Number(a.is_default),
      );
    },
  });
}
