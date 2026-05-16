import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { qk } from "../keys";

export function useCategories(supabase: SupabaseClient, merchantId: string | null) {
  return useQuery({
    enabled: Boolean(merchantId),
    queryKey: qk.categories(merchantId ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("merchant_id", merchantId)
        .eq("active", true)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useItems(
  supabase: SupabaseClient,
  merchantId: string | null,
  opts?: { categoryId?: string; mode?: "pos" | "kiosk" },
) {
  return useQuery({
    enabled: Boolean(merchantId),
    queryKey: qk.items(merchantId ?? "").concat([opts ?? {}]) as readonly unknown[],
    queryFn: async () => {
      let q = supabase
        .from("items")
        .select("*, modifier_groups:modifier_group_ids(*, modifier_options(*))")
        .eq("merchant_id", merchantId)
        .eq("active", true)
        .order("display_order");
      if (opts?.categoryId) q = q.eq("category_id", opts.categoryId);
      if (opts?.mode === "kiosk") q = q.eq("pos_only", false);
      if (opts?.mode === "pos") q = q.eq("kiosk_only", false);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}
