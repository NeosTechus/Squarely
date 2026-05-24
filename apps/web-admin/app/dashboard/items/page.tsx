"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import Reveal from "@/components/Reveal";

interface Item {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
  image_url: string | null;
  pos_only: boolean;
  kiosk_only: boolean;
}

type Visibility = "both" | "pos" | "kiosk";

function visibilityOf(it: Item): Visibility {
  if (it.pos_only) return "pos";
  if (it.kiosk_only) return "kiosk";
  return "both";
}

function visibilityFlags(v: Visibility) {
  return {
    pos_only: v === "pos",
    kiosk_only: v === "kiosk",
  };
}

export default function Items() {
  const qc = useQueryClient();
  const { data: merchantId } = useActiveMerchant();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  // The generated Database types are empty in this scaffold, so the typed
  // query builder resolves to `never`; use an untyped client for these calls.
  const supabase = createBrowserClient() as unknown as {
    from: (t: string) => any;
    storage: any;
  };

  const { data: items = [], isLoading, error } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["items", merchantId],
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("items")
        .select("id, name, price_cents, active, image_url, pos_only, kiosk_only")
        .eq("merchant_id", merchantId)
        .order("display_order");
      if (error) throw error;
      return (data as Item[]) ?? [];
    },
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const cents = Math.round(parseFloat(price) * 100);
      if (!name.trim() || Number.isNaN(cents) || cents < 0) {
        throw new Error("Enter a name and a valid price.");
      }
      const { error } = await supabase
        .from("items")
        .insert({ merchant_id: merchantId, name: name.trim(), price_cents: cents });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setPrice("");
      setFormError(null);
      qc.invalidateQueries({ queryKey: ["items", merchantId] });
    },
    onError: (e) => setFormError((e as Error).message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRowError(null);
      qc.invalidateQueries({ queryKey: ["items", merchantId] });
    },
    onError: (e) => setRowError((e as Error).message),
  });

  const setVisibility = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: Visibility }) => {
      const { error } = await supabase
        .from("items")
        .update(visibilityFlags(v))
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRowError(null);
      qc.invalidateQueries({ queryKey: ["items", merchantId] });
    },
    onError: (e) => setRowError((e as Error).message),
  });

  async function uploadImage(itemId: string, file: File) {
    setRowError(null);
    setUploadingId(itemId);
    try {
      const path = `${merchantId}/${itemId}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("item-images")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const publicUrl = supabase.storage
        .from("item-images")
        .getPublicUrl(path).data.publicUrl;
      const { error: updErr } = await supabase
        .from("items")
        .update({ image_url: publicUrl })
        .eq("id", itemId);
      if (updErr) throw updErr;
      qc.invalidateQueries({ queryKey: ["items", merchantId] });
    } catch (e) {
      setRowError((e as Error).message);
    } finally {
      setUploadingId(null);
    }
  }

  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

  const visBtn = (active: boolean) =>
    `px-2 py-1 text-xs font-medium transition ${
      active ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
    }`;

  return (
    <div className="max-w-2xl space-y-6">
      <Reveal as="h1" className="text-2xl font-bold tracking-tight">
        Items
      </Reveal>

      <Reveal>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addItem.mutate();
        }}
        className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <label className="flex-1 text-sm">
          <span className="text-slate-700">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cappuccino"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
          />
        </label>
        <label className="w-28 text-sm">
          <span className="text-slate-700">Price</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="4.50"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={addItem.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {addItem.isPending ? "Adding…" : "Add item"}
        </button>
      </form>
      </Reveal>
      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      {rowError ? <p className="text-sm text-red-600">{rowError}</p> : null}

      <Reveal className="rounded-2xl border border-slate-200 bg-white">
        {isLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">{(error as Error).message}</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No items yet — add your first above.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((it) => {
              const vis = visibilityOf(it);
              return (
                <li key={it.id} className="flex items-center gap-4 px-6 py-3 transition hover:bg-slate-50">
                  <label className="relative shrink-0 cursor-pointer">
                    {it.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.image_url}
                        alt={it.name}
                        className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400">
                        Add
                      </span>
                    )}
                    {uploadingId === it.id ? (
                      <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70 text-[10px] text-slate-600">
                        …
                      </span>
                    ) : null}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingId === it.id}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadImage(it.id, f);
                        e.target.value = "";
                      }}
                    />
                  </label>

                  <span className="flex-1 font-medium">{it.name}</span>

                  <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-300">
                    <button
                      type="button"
                      onClick={() => setVisibility.mutate({ id: it.id, v: "both" })}
                      className={visBtn(vis === "both")}
                    >
                      Both
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility.mutate({ id: it.id, v: "pos" })}
                      className={`border-l border-slate-300 ${visBtn(vis === "pos")}`}
                    >
                      POS
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility.mutate({ id: it.id, v: "kiosk" })}
                      className={`border-l border-slate-300 ${visBtn(vis === "kiosk")}`}
                    >
                      Kiosk
                    </button>
                  </div>

                  <span className="w-16 shrink-0 text-right text-slate-600">
                    {fmt(it.price_cents)}
                  </span>

                  <button
                    type="button"
                    aria-label={`Delete ${it.name}`}
                    disabled={deleteItem.isPending}
                    onClick={() => {
                      if (confirm(`Delete "${it.name}"? This can't be undone.`)) {
                        deleteItem.mutate(it.id);
                      }
                    }}
                    className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Reveal>
    </div>
  );
}
