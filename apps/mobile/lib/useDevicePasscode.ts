import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useActiveMerchant } from "./useActiveMerchant";

export type DevicePasscodeStatus = "loading" | "on" | "off" | "unknown";

/**
 * Whether the active merchant has a device passcode set, and a verifier.
 * The code itself is never read on the client — presence is a boolean and
 * verification happens via the verify_device_passcode RPC.
 *
 * We expose a tri-state status ("on" | "off" | "loading" | "unknown") so the
 * UI can fail closed (lock the device) on loading/error instead of treating
 * unknown as unlocked.
 */
export function useDevicePasscode() {
  const { data: merchantId } = useActiveMerchant();
  const { data, isLoading, isError } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["device-passcode-enabled", merchantId],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await (supabase as any)
        .from("merchants")
        .select("device_passcode")
        .eq("id", merchantId)
        .maybeSingle();
      if (error) throw new Error(error.message ?? "Failed to load passcode flag");
      return Boolean(data?.device_passcode);
    },
  });

  const status: DevicePasscodeStatus = !merchantId
    ? "loading"
    : isLoading
      ? "loading"
      : isError
        ? "unknown"
        : data === true
          ? "on"
          : data === false
            ? "off"
            : "unknown";

  // Back-compat: many call sites still destructure `{ enabled }`. Keep it true
  // for anything that isn't a confirmed "off" so they fail closed by default.
  const enabled = status !== "off";

  const verify = async (code: string): Promise<boolean> => {
    if (!merchantId) return false;
    const { data, error } = await (supabase as any).rpc("verify_device_passcode", {
      p_merchant_id: merchantId,
      p_code: code,
    });
    if (error) return false;
    return Boolean(data);
  };

  return { enabled, status, verify };
}
