import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

/** True if the signed-in user is a Squarely platform (super) admin. */
export function usePlatformAdmin() {
  return useQuery({
    queryKey: ["is-platform-admin"],
    queryFn: async (): Promise<boolean> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return false;
      const { data, error } = await (supabase as any)
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (error) return false;
      return Boolean(data);
    },
  });
}
