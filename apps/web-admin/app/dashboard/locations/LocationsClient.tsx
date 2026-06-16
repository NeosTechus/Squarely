"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { safeErrorMessage } from "@/lib/redact";
import { upsertLocation, setDefaultLocation, setLocationActive } from "./actions";

interface LocationRow {
  id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  timezone: string;
  active: boolean;
  created_at: string;
}

interface MerchantRow {
  id: string;
  default_location_id: string | null;
}

interface AggRow {
  location_id: string | null;
  order_count: number;
  revenue_cents: number;
}

const EMPTY_FORM = {
  id: "" as string,
  name: "",
  address_line1: "",
  city: "",
  region: "",
  postal_code: "",
  timezone: "America/New_York",
  active: true,
};

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function LocationsClient({ merchantId }: { merchantId: string }) {
  const qc = useQueryClient();
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  // Locations list
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["locations", merchantId],
    queryFn: async (): Promise<LocationRow[]> => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, address_line1, city, region, postal_code, timezone, active, created_at")
        .eq("merchant_id", merchantId)
        .order("created_at");
      if (error) throw new Error(safeErrorMessage(error));
      return (data as LocationRow[]) ?? [];
    },
  });

  // Merchant row for default_location_id
  const { data: merchant } = useQuery({
    queryKey: ["merchant-default-location", merchantId],
    queryFn: async (): Promise<MerchantRow | null> => {
      const { data, error } = await supabase
        .from("merchants")
        .select("id, default_location_id")
        .eq("id", merchantId)
        .maybeSingle();
      if (error) throw new Error(safeErrorMessage(error));
      return (data as MerchantRow | null) ?? null;
    },
  });

  // Per-location 30-day rollup. Pulls orders client-side and aggregates —
  // small merchants only; large merchants need a SQL-side group-by RPC.
  const { data: agg = [] } = useQuery({
    queryKey: ["location-rollup", merchantId],
    queryFn: async (): Promise<AggRow[]> => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
      const { data, error } = await supabase
        .from("orders")
        .select("location_id, total_cents, payment_status, created_at")
        .eq("merchant_id", merchantId)
        .gte("created_at", since)
        .eq("payment_status", "paid");
      if (error) throw new Error(safeErrorMessage(error));
      const buckets = new Map<string | null, AggRow>();
      for (const r of (data ?? []) as { location_id: string | null; total_cents: number }[]) {
        const key = r.location_id ?? null;
        const cur = buckets.get(key) ?? { location_id: key, order_count: 0, revenue_cents: 0 };
        cur.order_count += 1;
        cur.revenue_cents += r.total_cents;
        buckets.set(key, cur);
      }
      return Array.from(buckets.values());
    },
  });

  const aggByLoc = new Map(agg.map((a) => [a.location_id, a]));

  const save = useMutation({
    mutationFn: async () => {
      const res = await upsertLocation({
        merchantId,
        id: form.id || null,
        name: form.name,
        address_line1: form.address_line1,
        city: form.city,
        region: form.region,
        postal_code: form.postal_code,
        timezone: form.timezone,
        active: form.active,
      });
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => {
      setFormOk(form.id ? "Location updated." : "Location added.");
      setFormError(null);
      setForm({ ...EMPTY_FORM });
      qc.invalidateQueries({ queryKey: ["locations", merchantId] });
      qc.invalidateQueries({ queryKey: ["location-rollup", merchantId] });
    },
    onError: (e) => {
      setFormOk(null);
      setFormError(safeErrorMessage(e));
    },
  });

  const setDefault = useMutation({
    mutationFn: async (locationId: string | null) => {
      const res = await setDefaultLocation({ merchantId, locationId });
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["merchant-default-location", merchantId] }),
    onError: (e) => {
      setFormOk(null);
      setFormError(safeErrorMessage(e));
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (vars: { id: string; active: boolean }) => {
      const res = await setLocationActive({ merchantId, id: vars.id, active: vars.active });
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locations", merchantId] }),
    onError: (e) => {
      setFormOk(null);
      setFormError(safeErrorMessage(e));
    },
  });

  const beginEdit = (l: LocationRow) =>
    setForm({
      id: l.id,
      name: l.name,
      address_line1: l.address_line1 ?? "",
      city: l.city ?? "",
      region: l.region ?? "",
      postal_code: l.postal_code ?? "",
      timezone: l.timezone,
      active: l.active,
    });

  return (
    <div className="max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
        <p className="mt-1 text-sm text-slate-600">
          Stores, kiosks, or service points where you ring sales. Orders and
          devices are bound to a location; reports can roll up per-location or
          across the whole merchant.
        </p>
      </header>

      {/* Existing locations */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Your locations</h2>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : locations.length === 0 ? (
          <p className="text-sm text-slate-500">No locations yet. Add one below.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Address</th>
                  <th className="px-4 py-2">Timezone</th>
                  <th className="px-4 py-2 text-right">30d revenue</th>
                  <th className="px-4 py-2 text-right">30d orders</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {locations.map((l) => {
                  const a = aggByLoc.get(l.id);
                  const isDefault = merchant?.default_location_id === l.id;
                  return (
                    <tr key={l.id} className={!l.active ? "bg-slate-50/60 text-slate-500" : ""}>
                      <td className="px-4 py-2 font-medium">
                        {l.name}
                        {isDefault && (
                          <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
                            default
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {[l.address_line1, l.city, l.region, l.postal_code]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{l.timezone}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {a ? fmtMoney(a.revenue_cents) : "$0.00"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{a?.order_count ?? 0}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => toggleActive.mutate({ id: l.id, active: !l.active })}
                          className={`rounded px-2 py-0.5 text-xs ${
                            l.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {l.active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => beginEdit(l)}
                          className="mr-2 text-xs font-medium text-indigo-600 hover:underline"
                        >
                          Edit
                        </button>
                        {!isDefault && l.active && (
                          <button
                            type="button"
                            onClick={() => setDefault.mutate(l.id)}
                            className="text-xs font-medium text-slate-600 hover:underline"
                          >
                            Make default
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* Aggregate for orders rung without a location_id (legacy data) */}
                {aggByLoc.get(null) && (
                  <tr className="bg-amber-50/40 text-xs text-slate-600">
                    <td className="px-4 py-2 italic">(no location)</td>
                    <td className="px-4 py-2">—</td>
                    <td className="px-4 py-2">—</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {fmtMoney(aggByLoc.get(null)!.revenue_cents)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {aggByLoc.get(null)!.order_count}
                    </td>
                    <td className="px-4 py-2">—</td>
                    <td className="px-4 py-2"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Form */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">
          {form.id ? "Edit location" : "Add a location"}
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2"
        >
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Downtown shop"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Timezone</span>
            <input
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="America/New_York"
            />
          </label>
          <label className="md:col-span-2 text-sm">
            <span className="mb-1 block font-medium text-slate-700">Address line</span>
            <input
              value={form.address_line1}
              onChange={(e) => setForm((f) => ({ ...f, address_line1: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="123 Main St"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">City</span>
            <input
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">State / region</span>
            <input
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Postal code</span>
            <input
              value={form.postal_code}
              onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="md:col-span-2 mt-2 flex items-center justify-between">
            <div className="text-sm">
              {formError && <span className="text-rose-600">{formError}</span>}
              {formOk && <span className="text-emerald-600">{formOk}</span>}
            </div>
            <div className="flex gap-2">
              {form.id && (
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...EMPTY_FORM });
                    setFormError(null);
                    setFormOk(null);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={save.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : form.id ? "Save changes" : "Add location"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
