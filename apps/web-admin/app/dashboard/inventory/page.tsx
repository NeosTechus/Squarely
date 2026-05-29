"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import Reveal from "@/components/Reveal";

interface Location {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
}

interface Level {
  item_id: string;
  location_id: string;
  quantity: number;
  reorder_threshold: number | null;
}

interface Row {
  item: Item;
  quantity: number;
  reorder_threshold: number | null;
}

export default function Inventory() {
  const qc = useQueryClient();
  const { data: merchantId } = useActiveMerchant();
  const [locationId, setLocationId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  // Local edit buffers keyed by item id.
  const [edits, setEdits] = useState<
    Record<string, { quantity: string; reorder: string }>
  >({});

  // The generated Database types are empty in this scaffold, so the typed
  // query builder resolves to `never`; use an untyped client for these calls.
  const supabase = createBrowserClient() as unknown as {
    from: (t: string) => any;
  };

  const { data: locations = [], isLoading: locLoading } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["locations", merchantId],
    queryFn: async (): Promise<Location[]> => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .eq("merchant_id", merchantId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data as Location[]) ?? [];
    },
  });

  // Default to the first location once locations load.
  useEffect(() => {
    if (!locationId && locations[0]) setLocationId(locations[0].id);
  }, [locations, locationId]);

  const {
    data: rows = [],
    isLoading: rowsLoading,
    error,
  } = useQuery({
    enabled: Boolean(merchantId) && Boolean(locationId),
    queryKey: ["inventory", merchantId, locationId],
    queryFn: async (): Promise<Row[]> => {
      const [itemsRes, levelsRes] = await Promise.all([
        supabase
          .from("items")
          .select("id, name")
          .eq("merchant_id", merchantId)
          .order("display_order"),
        supabase
          .from("inventory_levels")
          .select("item_id, location_id, quantity, reorder_threshold")
          .eq("merchant_id", merchantId)
          .eq("location_id", locationId),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (levelsRes.error) throw levelsRes.error;
      const items = (itemsRes.data as Item[]) ?? [];
      const levels = (levelsRes.data as Level[]) ?? [];
      const byItem = new Map(levels.map((l) => [l.item_id, l]));
      return items.map((item) => {
        const lvl = byItem.get(item.id);
        return {
          item,
          quantity: lvl ? Number(lvl.quantity) : 0,
          reorder_threshold:
            lvl && lvl.reorder_threshold != null
              ? Number(lvl.reorder_threshold)
              : null,
        };
      });
    },
  });

  const save = useMutation({
    mutationFn: async ({
      itemId,
      quantity,
      reorder_threshold,
    }: {
      itemId: string;
      quantity: number;
      reorder_threshold: number | null;
    }) => {
      const { error } = await supabase.from("inventory_levels").upsert(
        {
          merchant_id: merchantId,
          item_id: itemId,
          location_id: locationId,
          quantity,
          reorder_threshold,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "item_id,location_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setRowError(null);
      qc.invalidateQueries({ queryKey: ["inventory", merchantId, locationId] });
    },
    onError: (e) => setRowError((e as Error).message),
  });

  function editFor(row: Row) {
    return (
      edits[row.item.id] ?? {
        quantity: String(row.quantity),
        reorder: row.reorder_threshold == null ? "" : String(row.reorder_threshold),
      }
    );
  }

  function setEdit(
    itemId: string,
    patch: { quantity?: string; reorder?: string },
    row: Row
  ) {
    setEdits((prev) => {
      const current =
        prev[itemId] ?? {
          quantity: String(row.quantity),
          reorder:
            row.reorder_threshold == null ? "" : String(row.reorder_threshold),
        };
      return { ...prev, [itemId]: { ...current, ...patch } };
    });
  }

  function commit(row: Row) {
    const e = edits[row.item.id];
    if (!e) return; // nothing changed
    const qty = parseFloat(e.quantity);
    if (Number.isNaN(qty) || qty < 0) {
      setRowError(`Enter a valid quantity for ${row.item.name}.`);
      return;
    }
    let reorder: number | null = null;
    if (e.reorder.trim() !== "") {
      const r = parseFloat(e.reorder);
      if (Number.isNaN(r) || r < 0) {
        setRowError(`Enter a valid reorder threshold for ${row.item.name}.`);
        return;
      }
      reorder = r;
    }
    const dirty = qty !== row.quantity || reorder !== row.reorder_threshold;
    // Clear the local buffer so the row reflects server state after refetch.
    setEdits((prev) => {
      const next = { ...prev };
      delete next[row.item.id];
      return next;
    });
    if (dirty) {
      save.mutate({
        itemId: row.item.id,
        quantity: qty,
        reorder_threshold: reorder,
      });
    }
  }

  const isLoading = locLoading || rowsLoading;

  return (
    <div className="max-w-3xl space-y-6">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        {locations.length > 0 ? (
          <label className="text-sm">
            <span className="mr-2 text-slate-600">Location</span>
            <select
              value={locationId ?? ""}
              onChange={(e) => setLocationId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </Reveal>

      {rowError ? <p className="text-sm text-red-600">{rowError}</p> : null}

      <Reveal className="rounded-2xl border border-slate-200 bg-white">
        {isLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">{(error as Error).message}</p>
        ) : !locationId ? (
          <p className="p-6 text-sm text-slate-500">No locations yet.</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No items yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-6 py-3 font-medium">Item</th>
                <th className="w-32 px-3 py-3 font-medium">Quantity</th>
                <th className="w-36 px-3 py-3 font-medium">Reorder at</th>
                <th className="w-24 px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const e = editFor(row);
                const low =
                  row.reorder_threshold != null &&
                  row.quantity <= row.reorder_threshold;
                const dirty = Boolean(edits[row.item.id]);
                return (
                  <tr key={row.item.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-3">
                      <span
                        className={`font-medium ${low ? "text-amber-600" : ""}`}
                      >
                        {row.item.name}
                      </span>
                      {low ? (
                        <span className="ml-2 text-xs text-amber-600">
                          Low stock
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <input
                        value={e.quantity}
                        inputMode="decimal"
                        onChange={(ev) =>
                          setEdit(row.item.id, { quantity: ev.target.value }, row)
                        }
                        onBlur={() => commit(row)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter")
                            (ev.target as HTMLInputElement).blur();
                        }}
                        className={`w-24 rounded-lg border px-3 py-1.5 focus:border-brand-600 focus:outline-none ${
                          low ? "border-amber-300 text-amber-700" : "border-slate-300"
                        }`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        value={e.reorder}
                        inputMode="decimal"
                        placeholder="—"
                        onChange={(ev) =>
                          setEdit(row.item.id, { reorder: ev.target.value }, row)
                        }
                        onBlur={() => commit(row)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter")
                            (ev.target as HTMLInputElement).blur();
                        }}
                        className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 focus:border-brand-600 focus:outline-none"
                      />
                    </td>
                    <td className="px-6 py-3 text-right">
                      {dirty ? (
                        <button
                          type="button"
                          onClick={() => commit(row)}
                          disabled={save.isPending}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Saved</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </Reveal>
    </div>
  );
}
