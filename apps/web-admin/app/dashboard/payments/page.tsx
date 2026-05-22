"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { GATEWAY_CATALOG, type GatewayPlugin } from "@squarely/payments";
import { useActiveMerchant } from "@/lib/useActiveMerchant";

// NOTE: secret config values (api keys, tokens) are stored in the `config`
// jsonb column. RLS restricts reads/writes to the merchant's owner/admin, so
// this is acceptable for now — but these secrets should move to a server-side
// vault / encrypted store before production.

interface GatewayRow {
  provider: string;
  enabled: boolean;
  is_default: boolean;
  config: Record<string, string> | null;
}

// Local editable state per gateway.
interface GatewayState {
  enabled: boolean;
  isDefault: boolean;
  config: Record<string, string>;
}

type StateMap = Record<string, GatewayState>;

function blankState(): StateMap {
  const m: StateMap = {};
  for (const g of GATEWAY_CATALOG) {
    m[g.id] = { enabled: false, isDefault: false, config: {} };
  }
  return m;
}

export default function Payments() {
  const qc = useQueryClient();
  const { data: merchantId } = useActiveMerchant();
  const [state, setState] = useState<StateMap>(blankState);
  const [error, setError] = useState<string | null>(null);

  // The generated Database types are empty in this scaffold, so the typed
  // query builder resolves to `never`; use an untyped client for these calls.
  const supabase = createBrowserClient() as unknown as {
    from: (t: string) => any;
  };

  const { data: rows = [], isLoading, error: loadError } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["payment-gateways", merchantId],
    queryFn: async (): Promise<GatewayRow[]> => {
      const { data, error } = await supabase
        .from("merchant_payment_gateways")
        .select("provider, enabled, is_default, config")
        .eq("merchant_id", merchantId);
      if (error) throw error;
      return (data as GatewayRow[]) ?? [];
    },
  });

  // Prefill local state from persisted rows whenever they load/change.
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
      if (!merchantId) throw new Error("No active merchant.");
      const s = state[gateway.id] ?? { enabled: false, isDefault: false, config: {} };

      // When setting a new default, clear is_default on all existing rows for
      // this merchant first so only one default remains.
      if (makeDefault) {
        const { error: clearErr } = await supabase
          .from("merchant_payment_gateways")
          .update({ is_default: false })
          .eq("merchant_id", merchantId);
        if (clearErr) throw clearErr;
      }

      const isDefault = makeDefault ? true : s.isDefault;

      const { error } = await supabase
        .from("merchant_payment_gateways")
        .upsert(
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
      qc.invalidateQueries({ queryKey: ["payment-gateways", merchantId] });
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose which payment gateways your store accepts and set one as the default.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loadError ? <p className="text-sm text-red-600">{(loadError as Error).message}</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}

      <div className="space-y-4">
        {GATEWAY_CATALOG.map((gateway) => {
          const s = state[gateway.id];
          if (!s) return null;
          const saving =
            saveGateway.isPending && saveGateway.variables?.gateway.id === gateway.id;
          return (
            <div
              key={gateway.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{gateway.label}</h2>
                    {s.isDefault && s.enabled ? (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        Default
                      </span>
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
                <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                  {gateway.configFields.length > 0 ? (
                    <div className="space-y-3">
                      {gateway.configFields.map((field) => (
                        <label key={field.key} className="block text-sm">
                          <span className="text-slate-700">
                            {field.label}
                            {field.optional ? (
                              <span className="text-slate-400"> (optional)</span>
                            ) : null}
                          </span>
                          <input
                            type={field.secret ? "password" : "text"}
                            value={s.config[field.key] ?? ""}
                            placeholder={field.placeholder}
                            autoComplete="off"
                            onChange={(e) =>
                              setConfigField(gateway.id, field.key, e.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
                          />
                        </label>
                      ))}
                    </div>
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
    </div>
  );
}
