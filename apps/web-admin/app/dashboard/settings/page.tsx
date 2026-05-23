"use client";

import { useEffect, useRef, useState } from "react";
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

interface MerchantSettings {
  name: string;
  brand_color: string;
  kiosk_image_url: string | null;
  kiosk_headline: string | null;
  kiosk_subtext: string | null;
}

export default function Settings() {
  const qc = useQueryClient();
  const { data: merchantId } = useActiveMerchant();
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any; storage: any };

  const [color, setColor] = useState("#4f46e5");
  const [headline, setHeadline] = useState("");
  const [subtext, setSubtext] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: merchant } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["merchant-settings", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("name, brand_color, kiosk_image_url, kiosk_headline, kiosk_subtext")
        .eq("id", merchantId)
        .single();
      if (error) throw error;
      return data as MerchantSettings;
    },
  });

  useEffect(() => {
    if (merchant) {
      setColor(merchant.brand_color || "#4f46e5");
      setHeadline(merchant.kiosk_headline ?? "");
      setSubtext(merchant.kiosk_subtext ?? "");
    }
  }, [merchant]);

  const saveColor = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase.from("merchants").update({ brand_color: next }).eq("id", merchantId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["merchant-settings", merchantId] }),
  });

  const saveKioskText = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("merchants")
        .update({ kiosk_headline: headline || null, kiosk_subtext: subtext || null })
        .eq("id", merchantId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["merchant-settings", merchantId] }),
  });

  async function uploadKioskImage(file: File) {
    if (!merchantId) return;
    setUploading(true);
    try {
      const path = `${merchantId}/kiosk-${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("item-images").upload(path, file, { upsert: true });
      if (up.error) throw up.error;
      const url = supabase.storage.from("item-images").getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from("merchants").update({ kiosk_image_url: url }).eq("id", merchantId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["merchant-settings", merchantId] });
    } finally {
      setUploading(false);
    }
  }

  async function removeKioskImage() {
    await supabase.from("merchants").update({ kiosk_image_url: null }).eq("id", merchantId);
    qc.invalidateQueries({ queryKey: ["merchant-settings", merchantId] });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {/* THEME */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Theme</h2>
        <p className="mt-1 text-sm text-slate-600">Brand color used on your POS and Kiosk screens.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.color}
              onClick={() => { setColor(p.color); saveColor.mutate(p.color); }}
              className={`h-12 w-12 rounded-full border-2 transition ${
                color.toLowerCase() === p.color.toLowerCase() ? "border-slate-900 scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: p.color }}
              aria-label={p.name}
            />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-slate-300" />
          <input value={color} onChange={(e) => setColor(e.target.value)}
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button onClick={() => saveColor.mutate(color)} disabled={saveColor.isPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: color }}>
            {saveColor.isPending ? "Saving…" : "Save color"}
          </button>
        </div>
      </section>

      {/* KIOSK LANDING */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Kiosk landing screen</h2>
        <p className="mt-1 text-sm text-slate-600">
          Customize the welcome screen customers see on the self-order kiosk.
        </p>

        {/* image */}
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Background image</div>
          <div className="mt-2 flex items-center gap-4">
            <div className="h-24 w-40 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {merchant?.kiosk_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={merchant.kiosk_image_url} alt="Kiosk" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">No image</div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadKioskImage(f); }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                {uploading ? "Uploading…" : merchant?.kiosk_image_url ? "Replace image" : "Upload image"}
              </button>
              {merchant?.kiosk_image_url ? (
                <button onClick={removeKioskImage} className="text-sm text-slate-500 hover:text-red-600">Remove</button>
              ) : null}
            </div>
          </div>
        </div>

        {/* text */}
        <div className="mt-5 space-y-3">
          <label className="block text-sm">
            <span className="text-slate-700">Headline</span>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Welcome"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Subtext</span>
            <input value={subtext} onChange={(e) => setSubtext(e.target.value)} placeholder="Tap anywhere to start your order"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <button onClick={() => saveKioskText.mutate()} disabled={saveKioskText.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {saveKioskText.isPending ? "Saving…" : "Save text"}
          </button>
        </div>

        {/* preview */}
        <div className="mt-6">
          <div className="text-xs uppercase tracking-wide text-slate-500">Preview</div>
          <div
            className="relative mt-2 flex h-40 flex-col items-center justify-center overflow-hidden rounded-2xl text-white"
            style={{ backgroundColor: color }}
          >
            {merchant?.kiosk_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={merchant.kiosk_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
            ) : null}
            <div className="relative text-3xl font-bold">{headline || "Welcome"}</div>
            <div className="relative mt-1 text-sm">{subtext || "Tap anywhere to start your order"}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
