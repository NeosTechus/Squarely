"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import { safeErrorMessage } from "@/lib/redact";
import Reveal from "@/components/Reveal";

interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  max_select: number;
  display_order: number | null;
}

interface ModifierOption {
  id: string;
  group_id: string;
  name: string;
  price_delta_cents: number;
  display_order: number | null;
  active: boolean;
}

export default function Modifiers() {
  const qc = useQueryClient();
  const { data: merchantId } = useActiveMerchant();

  const [groupName, setGroupName] = useState("");
  const [groupRequired, setGroupRequired] = useState(false);
  const [groupMaxSelect, setGroupMaxSelect] = useState("1");
  const [groupError, setGroupError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  // Per-group "add option" form state, keyed by group id.
  const [optName, setOptName] = useState<Record<string, string>>({});
  const [optPrice, setOptPrice] = useState<Record<string, string>>({});

  // The generated Database types are empty in this scaffold, so the typed
  // query builder resolves to `never`; use an untyped client for these calls.
  const supabase = createBrowserClient() as unknown as {
    from: (t: string) => any;
  };

  const {
    data: groups = [],
    isLoading,
    error,
  } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["modifier_groups", merchantId],
    queryFn: async (): Promise<ModifierGroup[]> => {
      const { data, error } = await supabase
        .from("modifier_groups")
        .select("id, name, required, max_select, display_order")
        .eq("merchant_id", merchantId)
        .order("display_order");
      if (error) throw error;
      return (data as ModifierGroup[]) ?? [];
    },
  });

  const groupIds = groups.map((g) => g.id);

  const { data: options = [] } = useQuery({
    enabled: Boolean(merchantId) && groupIds.length > 0,
    queryKey: ["modifier_options", merchantId, groupIds.join(",")],
    queryFn: async (): Promise<ModifierOption[]> => {
      const { data, error } = await supabase
        .from("modifier_options")
        .select("id, group_id, name, price_delta_cents, display_order, active")
        .in("group_id", groupIds)
        .order("display_order");
      if (error) throw error;
      return (data as ModifierOption[]) ?? [];
    },
  });

  const addGroup = useMutation({
    mutationFn: async () => {
      if (!merchantId) {
        throw new Error("No active merchant.");
      }
      const trimmed = groupName.trim();
      if (!trimmed) {
        throw new Error("Enter a group name.");
      }
      // Reject duplicate group names (case-insensitive) within the same merchant.
      // Names are how items reference groups in the UI, so duplicates are a
      // common source of accidental cycles where two groups look identical.
      const dupe = groups.some(
        (g) => g.name.trim().toLowerCase() === trimmed.toLowerCase(),
      );
      if (dupe) {
        throw new Error("A group with that name already exists.");
      }
      const max = Number(groupMaxSelect);
      if (!Number.isInteger(max) || max < 1) {
        throw new Error("Max select must be a whole number of at least 1.");
      }
      const { error } = await supabase.from("modifier_groups").insert({
        merchant_id: merchantId,
        name: trimmed,
        required: groupRequired,
        max_select: max,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setGroupName("");
      setGroupRequired(false);
      setGroupMaxSelect("1");
      setGroupError(null);
      qc.invalidateQueries({ queryKey: ["modifier_groups", merchantId] });
    },
    onError: (e) => setGroupError(safeErrorMessage(e)),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      if (!merchantId) {
        throw new Error("No active merchant.");
      }
      // Belt-and-braces tenant scoping: even though RLS will reject a delete
      // outside the active merchant, send the predicate explicitly so we never
      // issue a cross-tenant statement from the client.
      const { error } = await supabase
        .from("modifier_groups")
        .delete()
        .eq("id", id)
        .eq("merchant_id", merchantId);
      if (error) throw error;
    },
    onSuccess: () => {
      setRowError(null);
      qc.invalidateQueries({ queryKey: ["modifier_groups", merchantId] });
      qc.invalidateQueries({ queryKey: ["modifier_options", merchantId] });
    },
    onError: (e) => setRowError(safeErrorMessage(e)),
  });

  const addOption = useMutation({
    mutationFn: async (groupId: string) => {
      if (!merchantId) {
        throw new Error("No active merchant.");
      }
      // Cycle / cross-tenant guard: confirm the target group belongs to a
      // group we currently see for this merchant. The RLS policy on
      // modifier_options derives merchant from modifier_groups via group_id,
      // so this also blocks accidentally writing options under another
      // merchant's group_id (which would otherwise be RLS-rejected, but
      // we want the friendlier error path).
      const parentGroup = groups.find((g) => g.id === groupId);
      if (!parentGroup) {
        throw new Error("Modifier group not found for this merchant.");
      }
      const name = (optName[groupId] ?? "").trim();
      const priceRaw = (optPrice[groupId] ?? "").trim();
      if (!name) {
        throw new Error("Enter an option name.");
      }
      // Prevent circular references: an option can't be named the same as
      // its parent group (a common shorthand for self-referencing groups),
      // and option names must be unique within the group so traversal
      // through options can't ever revisit the same node.
      if (name.toLowerCase() === parentGroup.name.trim().toLowerCase()) {
        throw new Error(
          "Option name cannot match the parent group name (would create a circular reference).",
        );
      }
      const dupe = options.some(
        (o) =>
          o.group_id === groupId &&
          o.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (dupe) {
        throw new Error("An option with that name already exists in this group.");
      }
      const dollars = priceRaw === "" ? 0 : parseFloat(priceRaw);
      if (Number.isNaN(dollars)) {
        throw new Error("Enter a valid price delta (can be negative).");
      }
      const cents = Math.round(dollars * 100);
      const { error } = await supabase.from("modifier_options").insert({
        group_id: groupId,
        name,
        price_delta_cents: cents,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: (_data, groupId) => {
      setOptName((m) => ({ ...m, [groupId]: "" }));
      setOptPrice((m) => ({ ...m, [groupId]: "" }));
      setRowError(null);
      qc.invalidateQueries({ queryKey: ["modifier_options", merchantId] });
    },
    onError: (e) => setRowError(safeErrorMessage(e)),
  });

  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      if (!merchantId) {
        throw new Error("No active merchant.");
      }
      // Confirm the option belongs to a group owned by this merchant before
      // attempting the delete; RLS will reject cross-tenant deletes anyway,
      // but this avoids round-tripping a request that would error.
      const option = options.find((o) => o.id === id);
      if (!option) {
        throw new Error("Option not found for this merchant.");
      }
      const parent = groups.find((g) => g.id === option.group_id);
      if (!parent) {
        throw new Error("Option's group not found for this merchant.");
      }
      const { error } = await supabase
        .from("modifier_options")
        .delete()
        .eq("id", id)
        .eq("group_id", parent.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRowError(null);
      qc.invalidateQueries({ queryKey: ["modifier_options", merchantId] });
    },
    onError: (e) => setRowError(safeErrorMessage(e)),
  });

  const fmtDelta = (c: number) => {
    const sign = c < 0 ? "−" : "+";
    return `${sign}$${(Math.abs(c) / 100).toFixed(2)}`;
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Reveal as="h1" className="text-2xl font-bold tracking-tight">
        Modifiers
      </Reveal>

      <Reveal>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addGroup.mutate();
          }}
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <label className="flex-1 text-sm">
            <span className="text-slate-700">Group name</span>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Milk choice"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
            />
          </label>
          <label className="w-28 text-sm">
            <span className="text-slate-700">Max select</span>
            <input
              value={groupMaxSelect}
              onChange={(e) => setGroupMaxSelect(e.target.value)}
              inputMode="numeric"
              placeholder="1"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={groupRequired}
              onChange={(e) => setGroupRequired(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
            />
            <span className="text-slate-700">Required</span>
          </label>
          <button
            type="submit"
            disabled={addGroup.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {addGroup.isPending ? "Adding…" : "Add group"}
          </button>
        </form>
      </Reveal>
      {groupError ? <p className="text-sm text-red-600">{groupError}</p> : null}
      {rowError ? <p className="text-sm text-red-600">{rowError}</p> : null}

      {isLoading ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading…
        </p>
      ) : error ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-red-600">
          {safeErrorMessage(error)}
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No modifier groups yet — add your first above.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const groupOptions = options.filter((o) => o.group_id === g.id);
            return (
              <Reveal
                key={g.id}
                className="rounded-2xl border border-slate-200 bg-white"
              >
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-6">
                  <span className="min-w-0 truncate font-medium">{g.name}</span>
                  {g.required ? (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      Required
                    </span>
                  ) : null}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    Max {g.max_select}
                  </span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    aria-label={`Delete ${g.name}`}
                    disabled={deleteGroup.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          `Delete group "${g.name}" and all its options? This can't be undone.`,
                        )
                      ) {
                        deleteGroup.mutate(g.id);
                      }
                    }}
                    className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete group
                  </button>
                </div>

                {groupOptions.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-500 sm:px-6">
                    No options yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {groupOptions.map((o) => (
                      <li
                        key={o.id}
                        className="flex items-center gap-4 px-4 py-2.5 sm:px-6"
                      >
                        <span className="min-w-0 flex-1 truncate">{o.name}</span>
                        {!o.active ? (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            Inactive
                          </span>
                        ) : null}
                        <span className="w-20 shrink-0 text-right text-sm text-slate-600">
                          {fmtDelta(o.price_delta_cents)}
                        </span>
                        <button
                          type="button"
                          aria-label={`Delete ${o.name}`}
                          disabled={deleteOption.isPending}
                          onClick={() => deleteOption.mutate(o.id)}
                          className="shrink-0 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addOption.mutate(g.id);
                  }}
                  className="flex flex-wrap items-end gap-3 border-t border-slate-100 px-4 py-3 sm:px-6"
                >
                  <label className="flex-1 text-sm">
                    <span className="text-slate-700">Option name</span>
                    <input
                      value={optName[g.id] ?? ""}
                      onChange={(e) =>
                        setOptName((m) => ({ ...m, [g.id]: e.target.value }))
                      }
                      placeholder="Oat milk"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
                    />
                  </label>
                  <label className="w-32 text-sm">
                    <span className="text-slate-700">Price delta</span>
                    <input
                      value={optPrice[g.id] ?? ""}
                      onChange={(e) =>
                        setOptPrice((m) => ({ ...m, [g.id]: e.target.value }))
                      }
                      inputMode="decimal"
                      placeholder="0.50 or -1.00"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={addOption.isPending}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {addOption.isPending ? "Adding…" : "Add option"}
                  </button>
                </form>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
