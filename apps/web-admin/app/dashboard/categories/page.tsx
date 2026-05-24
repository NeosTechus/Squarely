"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";

interface Category {
  id: string;
  name: string;
  display_order: number | null;
  image_url: string | null;
  active: boolean;
}

export default function Categories() {
  const qc = useQueryClient();
  const { data: merchantId } = useActiveMerchant();
  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // The generated Database types are empty in this scaffold, so the typed
  // query builder resolves to `never`; use an untyped client for these calls.
  const supabase = createBrowserClient() as unknown as {
    from: (t: string) => any;
  };

  const { data: categories = [], isLoading, error } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["categories", merchantId],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, display_order, image_url, active")
        .eq("merchant_id", merchantId)
        .order("display_order");
      if (error) throw error;
      return (data as Category[]) ?? [];
    },
  });

  const addCategory = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error("Enter a category name.");
      }
      const trimmedOrder = displayOrder.trim();
      let order: number | null = null;
      if (trimmedOrder) {
        const parsed = Number(trimmedOrder);
        if (!Number.isInteger(parsed) || parsed < 0) {
          throw new Error("Display order must be a non-negative whole number.");
        }
        order = parsed;
      }
      const { error } = await supabase.from("categories").insert({
        merchant_id: merchantId,
        name: name.trim(),
        active: true,
        ...(order !== null ? { display_order: order } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setDisplayOrder("");
      setFormError(null);
      qc.invalidateQueries({ queryKey: ["categories", merchantId] });
    },
    onError: (e) => setFormError((e as Error).message),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Categories</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          addCategory.mutate();
        }}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <label className="flex-1 text-sm">
          <span className="text-slate-700">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Beverages"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
          />
        </label>
        <label className="w-28 text-sm">
          <span className="text-slate-700">Order</span>
          <input
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            inputMode="numeric"
            placeholder="optional"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={addCategory.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {addCategory.isPending ? "Adding…" : "Add category"}
        </button>
      </form>
      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

      <div className="rounded-2xl border border-slate-200 bg-white">
        {isLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">{(error as Error).message}</p>
        ) : categories.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No categories yet — add your first above.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((cat) => (
              <li key={cat.id} className="flex items-center gap-4 px-4 py-3 sm:px-6">
                {cat.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400">
                    No image
                  </span>
                )}
                <span className="flex-1 font-medium">{cat.name}</span>
                {!cat.active ? (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                    Inactive
                  </span>
                ) : null}
                <span className="w-16 shrink-0 text-right text-slate-600">
                  {cat.display_order ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
