import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { qk } from "../keys";

export function useOpenOrders(supabase: SupabaseClient, merchantId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    enabled: Boolean(merchantId),
    queryKey: qk.openOrders(merchantId ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, items:order_items(*, modifiers:order_item_modifiers(*))")
        .eq("merchant_id", merchantId)
        .in("status", ["pending", "received", "preparing", "ready"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!merchantId) return;
    const channel = supabase
      .channel(`orders:${merchantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `merchant_id=eq.${merchantId}` },
        () => qc.invalidateQueries({ queryKey: qk.openOrders(merchantId) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, merchantId, qc]);

  return query;
}

export function useOrder(supabase: SupabaseClient, merchantId: string | null, orderId: string | null) {
  return useQuery({
    enabled: Boolean(merchantId && orderId),
    queryKey: qk.order(merchantId ?? "", orderId ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, items:order_items(*, modifiers:order_item_modifiers(*))")
        .eq("id", orderId)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
