"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";

const PRESETS = [
  { name: "Indigo", color: "#4f46e5" },
  { name: "Emerald", color: "#059669" },
  { name: "Rose", color: "#e11d48" },
  { name: "Amber", color: "#d97706" },
  { name: "Sky", color: "#0284c7" },
  { name: "Violet", color: "#7c3aed" },
  { name: "Slate", color: "#334155" },
];

export default function Settings() {
  const qc = useQueryClient();
  const { data: merchantId } = useActiveMerchant();
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };

  const [color, setColor] = useState("#4f46e5");

  const { data: merchant } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["merchant-theme", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("name, brand_color")
        .eq("id", merchantId)
        .single();
      if (error) throw error;
      return data as { name: string; brand_color: string };
    },
  });

  useEffect(() => {
    if (merchant?.brand_color) setColor(merchant.brand_color);
  }, [merchant?.brand_color]);

  const save = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase
        .from("merchants")
        .update({ brand_color: next })
        .eq("id", merchantId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["merchant-theme", merchantId] }),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Theme</h2>
        <p className="mt-1 text-sm text-slate-600">
          Brand color used on your POS and customer-facing Kiosk screens.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.color}
              onClick={() => {
                setColor(p.color);
                save.mutate(p.color);
              }}
              className={`h-12 w-12 rounded-full border-2 transition ${
                color.toLowerCase() === p.color.toLowerCase()
                  ? "border-slate-900 scale-110"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: p.color }}
              aria-label={p.name}
              title={p.name}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-slate-300"
          />
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => save.mutate(color)}
            disabled={save.isPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: color }}
          >
            {save.isPending ? "Saving…" : "Save color"}
          </button>
        </div>

        <div className="mt-6">
          <div className="text-xs uppercase tracking-wide text-slate-500">Preview</div>
          <div
            className="mt-2 flex h-24 items-center justify-center rounded-2xl text-xl font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {merchant?.name ?? "Your store"}
          </div>
        </div>

        {save.isError ? (
          <p className="mt-3 text-sm text-red-600">{(save.error as Error).message}</p>
        ) : null}
      </section>
    </div>
  );
}
