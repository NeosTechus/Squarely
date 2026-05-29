import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useActiveMerchant } from "./useActiveMerchant";

/**
 * Whether the active merchant has a device passcode set, and a verifier.
 * The code itself is never read on the client — presence is a boolean and
 * verification happens via the verify_device_passcode RPC.
 */
export function useDevicePasscode() {
  const { data: merchantId } = useActiveMerchant();
  const { data: enabled = false } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["device-passcode-enabled", merchantId],
    queryFn: async (): Promise<boolean> => {
      const { data } = await (supabase as any)
        .from("merchants")
        .select("device_passcode")
        .eq("id", merchantId)
        .maybeSingle();
      return Boolean(data?.device_passcode);
    },
  });

  const verify = async (code: string): Promise<boolean> => {
    if (!merchantId) return false;
    const { data, error } = await (supabase as any).rpc("verify_device_passcode", {
      p_merchant_id: merchantId,
      p_code: code,
    });
    if (error) return false;
    return Boolean(data);
  };

  return { enabled, verify };
}
