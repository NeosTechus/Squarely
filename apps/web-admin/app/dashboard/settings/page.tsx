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
  tax_rate_bps: number | null;
  region: string | null;
  city: string | null;
  device_passcode: string | null;
}

const MAX_TAX_PERCENT = 30;

export default function Settings() {
  const qc = useQueryClient();
  const { data: merchantId } = useActiveMerchant();
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any; storage: any; rpc: (fn: string, args?: any) => Promise<{ data: any; error: any }> };

  const [color, setColor] = useState("#4f46e5");
  const [headline, setHeadline] = useState("");
  const [subtext, setSubtext] = useState("");
  const [taxPercent, setTaxPercent] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [cityVal, setCityVal] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: merchant } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["merchant-settings", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("name, brand_color, kiosk_image_url, kiosk_headline, kiosk_subtext, tax_rate_bps, region, city, device_passcode")
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
      setTaxPercent(merchant.tax_rate_bps ? String(merchant.tax_rate_bps / 100) : "");
      setStateVal(merchant.region ?? "");
      setCityVal(merchant.city ?? "");
    }
  }, [merchant]);

  // Resolved location-based rate (used unless a manual override is set).
  const { data: locationBps = 0 } = useQuery({
    enabled: Boolean(merchant?.region),
    queryKey: ["resolve-tax", merchant?.region, merchant?.city],
    queryFn: async (): Promise<number> => {
      const { data } = await supabase.rpc("resolve_tax_bps", { p_state: merchant?.region ?? null, p_city: merchant?.city ?? null });
      return Number(data ?? 0);
    },
  });

  const [passcode, setPasscode] = useState("");
  const savePasscode = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc("set_device_passcode", { p_merchant_id: merchantId, p_code: code });
      if (error) throw new Error(error.message);
      if (data && data !== "ok") throw new Error(data as string);
    },
    onSuccess: () => { setPasscode(""); qc.invalidateQueries({ queryKey: ["merchant-settings", merchantId] }); },
  });

  const saveLocation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("merchants")
        .update({ region: stateVal.trim().toUpperCase() || null, city: cityVal.trim() || null })
        .eq("id", merchantId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["merchant-settings", merchantId] }),
  });

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

  const saveTax = useMutation({
    mutationFn: async (bps: number) => {
      const { error } = await supabase.from("merchants").update({ tax_rate_bps: bps }).eq("id", merchantId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["merchant-settings", merchantId] }),
  });

  function submitTax() {
    const trimmed = taxPercent.trim();
    if (trimmed === "") {
      saveTax.mutate(0);
      return;
    }
    const pct = Number(trimmed);
    if (!Number.isFinite(pct) || pct < 0 || pct > MAX_TAX_PERCENT) return;
    saveTax.mutate(Math.round(pct * 100));
  }

  const taxValue = taxPercent.trim();
  const taxNum = taxValue === "" ? 0 : Number(taxValue);
  const taxInvalid = taxValue !== "" && (!Number.isFinite(taxNum) || taxNum < 0 || taxNum > MAX_TAX_PERCENT);

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

      {/* SALES TAX */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Sales tax</h2>
        <p className="mt-1 text-sm text-slate-600">
          Tax is set automatically from your store&apos;s state &amp; city, applied to POS and Kiosk orders.
        </p>

        {/* Location */}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="text-slate-700">State</span>
            <input
              value={stateVal}
              onChange={(e) => setStateVal(e.target.value)}
              placeholder="CA"
              maxLength={2}
              className="mt-1 w-20 rounded-lg border border-slate-300 px-3 py-2 uppercase"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">City</span>
            <input
              value={cityVal}
              onChange={(e) => setCityVal(e.target.value)}
              placeholder="Los Angeles"
              className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            onClick={() => saveLocation.mutate()}
            disabled={saveLocation.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saveLocation.isPending ? "Saving…" : "Save location"}
          </button>
        </div>

        <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm">
          {merchant?.region ? (
            <span className="text-slate-700">
              Location rate for <strong>{merchant.city ? `${merchant.city}, ` : ""}{merchant.region}</strong>:{" "}
              <strong>{(locationBps / 100).toFixed(2)}%</strong>
              {merchant.tax_rate_bps ? <span className="text-slate-400"> (overridden below)</span> : null}
            </span>
          ) : (
            <span className="text-slate-500">Set your state to auto-apply the local tax rate.</span>
          )}
        </div>

        {/* Manual override */}
        <div className="mt-5 space-y-3 border-t border-slate-100 pt-5">
          <label className="block text-sm">
            <span className="text-slate-700">Manual override (%)</span>
            <span className="block text-xs text-slate-400">Leave blank to use the location rate above.</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={MAX_TAX_PERCENT}
              step="0.01"
              value={taxPercent}
              onChange={(e) => setTaxPercent(e.target.value)}
              placeholder="auto"
              className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          {taxInvalid ? <p className="text-sm text-red-600">Enter a number between 0 and {MAX_TAX_PERCENT}.</p> : null}
          {saveTax.isSuccess ? <p className="text-sm text-emerald-600">Saved.</p> : null}
          <button
            onClick={submitTax}
            disabled={saveTax.isPending || taxInvalid}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {saveTax.isPending ? "Saving…" : "Save override"}
          </button>
        </div>
      </section>

      {/* DEVICE PASSCODE */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Device passcode</h2>
        <p className="mt-1 text-sm text-slate-600">
          Require a passcode to enter POS or Kiosk mode on a device.{" "}
          <span className="font-medium text-slate-700">{merchant?.device_passcode ? "Currently set." : "Not set."}</span>
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="text-slate-700">Passcode (4–8 digits)</span>
            <input
              type="password"
              inputMode="numeric"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
              placeholder="••••"
              autoComplete="off"
              className="mt-1 w-40 rounded-lg border border-slate-300 px-3 py-2 tracking-widest"
            />
          </label>
          <button
            onClick={() => savePasscode.mutate(passcode)}
            disabled={savePasscode.isPending || passcode.length < 4}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {savePasscode.isPending ? "Saving…" : merchant?.device_passcode ? "Change passcode" : "Set passcode"}
          </button>
          {merchant?.device_passcode ? (
            <button
              onClick={() => savePasscode.mutate("")}
              disabled={savePasscode.isPending}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Remove
            </button>
          ) : null}
        </div>
        {savePasscode.isError ? <p className="mt-2 text-sm text-red-600">{(savePasscode.error as Error).message}</p> : null}
        {savePasscode.isSuccess ? <p className="mt-2 text-sm text-emerald-600">Saved.</p> : null}
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
