import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

/**
 * True if the signed-in user is a Squarely platform (super) admin.
 * Reads the user id from the locally-cached session (no network roundtrip) —
 * the RLS-protected select below is what actually verifies admin status.
 */
export function usePlatformAdmin() {
  return useQuery({
    queryKey: ["is-platform-admin"],
    queryFn: async (): Promise<boolean> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return false;
      const { data, error } = await (supabase as any)
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return false;
      return Boolean(data);
    },
  });
}
