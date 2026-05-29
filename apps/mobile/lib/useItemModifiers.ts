import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

export interface ModifierOption {
  id: string;
  group_id: string;
  name: string;
  price_delta_cents: number;
}
export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  max_select: number;
  options: ModifierOption[];
}

/** Loads the modifier groups + options for an item (by its modifier_group_ids). */
export function useItemModifiers(groupIds: string[] | null | undefined) {
  const ids = groupIds ?? [];
  return useQuery({
    enabled: ids.length > 0,
    queryKey: ["item-modifiers", [...ids].sort().join(",")],
    queryFn: async (): Promise<ModifierGroup[]> => {
      const [{ data: groups }, { data: options }] = await Promise.all([
        (supabase as any).from("modifier_groups").select("id, name, required, max_select, display_order").in("id", ids).order("display_order"),
        (supabase as any).from("modifier_options").select("id, group_id, name, price_delta_cents, display_order, active").in("group_id", ids).eq("active", true).order("display_order"),
      ]);
      const opts = (options ?? []) as (ModifierOption & { active: boolean })[];
      return ((groups ?? []) as Omit<ModifierGroup, "options">[]).map((g) => ({
        ...g,
        options: opts.filter((o) => o.group_id === g.id),
      }));
    },
  });
}
