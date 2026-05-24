"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { GATEWAY_CATALOG, type GatewayPlugin } from "@squarely/payments";

// Per-merchant payment gateway editor. Platform admins manage this for clients;
// RLS (pa_all) lets a platform admin read/write any merchant's gateways.
// NOTE: secret config values live in the `config` jsonb column — move to an
// encrypted server-side store before real production processing.

interface GatewayRow {
  provider: string;
  enabled: boolean;
  is_default: boolean;
  config: Record<string, string> | null;
}
interface GatewayState {
  enabled: boolean;
  isDefault: boolean;
  config: Record<string, string>;
}
type StateMap = Record<string, GatewayState>;

function blankState(): StateMap {
  const m: StateMap = {};
  for (const g of GATEWAY_CATALOG) m[g.id] = { enabled: false, isDefault: false, config: {} };
  return m;
}

export function GatewayEditor({ merchantId }: { merchantId: string }) {
  const qc = useQueryClient();
  const [state, setState] = useState<StateMap>(blankState);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };

  const { data: rows = [], isLoading } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["mpg", merchantId],
    queryFn: async (): Promise<GatewayRow[]> => {
      const { data, error } = await supabase
        .from("merchant_payment_gateways")
        .select("provider, enabled, is_default, config")
        .eq("merchant_id", merchantId);
      if (error) throw error;
      return (data as GatewayRow[]) ?? [];
    },
  });

  useEffect(() => {
    const next = blankState();
    for (const r of rows) {
      if (!next[r.provider]) continue;
      next[r.provider] = {
        enabled: r.enabled,
        isDefault: r.is_default,
        config: (r.config as Record<string, string>) ?? {},
      };
    }
    setState(next);
  }, [rows]);

  const saveGateway = useMutation({
    mutationFn: async ({ gateway, makeDefault }: { gateway: GatewayPlugin; makeDefault?: boolean }) => {
      const s = state[gateway.id] ?? { enabled: false, isDefault: false, config: {} };
      if (makeDefault) {
        const { error: clearErr } = await supabase
          .from("merchant_payment_gateways")
          .update({ is_default: false })
          .eq("merchant_id", merchantId);
        if (clearErr) throw clearErr;
      }
      const isDefault = makeDefault ? true : s.isDefault;
      const { error } = await supabase.from("merchant_payment_gateways").upsert(
        {
          merchant_id: merchantId,
          provider: gateway.id,
          enabled: s.enabled,
          is_default: isDefault && s.enabled,
          config: s.config,
        },
        { onConflict: "merchant_id,provider" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["mpg", merchantId] });
    },
    onError: (e) => setError((e as Error).message),
  });

  function patch(id: string, p: Partial<GatewayState>) {
    setState((prev) => {
      const cur = prev[id] ?? { enabled: false, isDefault: false, config: {} };
      return { ...prev, [id]: { ...cur, ...p } };
    });
  }
  function setConfigField(id: string, key: string, value: string) {
    setState((prev) => {
      const cur = prev[id] ?? { enabled: false, isDefault: false, config: {} };
      return { ...prev, [id]: { ...cur, config: { ...cur.config, [key]: value } } };
    });
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {GATEWAY_CATALOG.map((gateway) => {
        const s = state[gateway.id];
        if (!s) return null;
        const saving = saveGateway.isPending && saveGateway.variables?.gateway.id === gateway.id;
        return (
          <div key={gateway.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{gateway.label}</h3>
                  {s.isDefault && s.enabled ? (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Default</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-500">{gateway.description}</p>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
                <span className="text-slate-600">{s.enabled ? "Enabled" : "Off"}</span>
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={(e) => patch(gateway.id, { enabled: e.target.checked })}
                  className="h-4 w-4 accent-brand-600"
                />
              </label>
            </div>
            {s.enabled ? (
              <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                {gateway.configFields.length > 0 ? (
                  gateway.configFields.map((field) => (
                    <label key={field.key} className="block text-sm">
                      <span className="text-slate-700">
                        {field.label}
                        {field.optional ? <span className="text-slate-400"> (optional)</span> : null}
                      </span>
                      <input
                        type={field.secret ? "password" : "text"}
                        value={s.config[field.key] ?? ""}
                        placeholder={field.placeholder}
                        autoComplete="off"
                        onChange={(e) => setConfigField(gateway.id, field.key, e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
                      />
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No configuration needed.</p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => saveGateway.mutate({ gateway })}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    disabled={saving || s.isDefault}
                    onClick={() => saveGateway.mutate({ gateway, makeDefault: true })}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {s.isDefault ? "Default gateway" : "Set as default"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
