"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";

interface Device {
  id: string;
  name: string;
  kind: string;
  boot_mode: string;
  app_version: string | null;
  os_version: string | null;
  last_seen_at: string | null;
  active: boolean;
}

interface Terminal {
  id: string;
  label: string;
  provider: string;
  epi: string | null;
  serial: string | null;
  active: boolean;
}

interface Printer {
  id: string;
  label: string;
  model: string;
  kind: "lan" | "cloud" | null;
  ip_address: string | null;
  port: number | null;
  serial: string | null;
  is_default: boolean | null;
  supports_cash_drawer: boolean;
  active: boolean;
}

function fmtDate(ts: string | null): string {
  if (!ts) return "Never";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? "bg-green-100 text-green-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function Devices() {
  const qc = useQueryClient();
  const { data: merchantId } = useActiveMerchant();

  // The generated Database types are empty in this scaffold, so the typed
  // query builder resolves to `never`; use an untyped client for these calls.
  const supabase = createBrowserClient() as unknown as {
    from: (t: string) => any;
  };

  const devicesQ = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["devices", merchantId],
    queryFn: async (): Promise<Device[]> => {
      const { data, error } = await supabase
        .from("devices")
        .select(
          "id, name, kind, boot_mode, app_version, os_version, last_seen_at, active"
        )
        .eq("merchant_id", merchantId)
        .order("created_at");
      if (error) throw error;
      return (data as Device[]) ?? [];
    },
  });

  const terminalsQ = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["terminals", merchantId],
    queryFn: async (): Promise<Terminal[]> => {
      const { data, error } = await supabase
        .from("terminals")
        .select("id, label, provider, epi, serial, active")
        .eq("merchant_id", merchantId)
        .order("label");
      if (error) throw error;
      return (data as Terminal[]) ?? [];
    },
  });

  const printersQ = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["printers", merchantId],
    queryFn: async (): Promise<Printer[]> => {
      const { data, error } = await supabase
        .from("printers")
        .select("id, label, model, kind, ip_address, port, serial, is_default, supports_cash_drawer, active")
        .eq("merchant_id", merchantId)
        .order("label");
      if (error) throw error;
      return (data as Printer[]) ?? [];
    },
  });

  // Add-printer form state (inline above the printers table).
  const [addPrinterOpen, setAddPrinterOpen] = useState(false);
  const [pLabel, setPLabel] = useState("");
  const [pModel, setPModel] = useState("Generic ESC-POS");
  const [pKind, setPKind] = useState<"lan" | "cloud">("lan");
  const [pIp, setPIp] = useState("");
  const [pPort, setPPort] = useState("9100");
  const [pCloudId, setPCloudId] = useState("");
  const [pDefault, setPDefault] = useState(false);
  const [pCashDrawer, setPCashDrawer] = useState(true);
  const [pErr, setPErr] = useState<string | null>(null);

  const resetPrinterForm = () => {
    setPLabel(""); setPModel("Generic ESC-POS"); setPKind("lan");
    setPIp(""); setPPort("9100"); setPCloudId("");
    setPDefault(false); setPCashDrawer(true); setPErr(null);
  };

  const addPrinter = useMutation({
    mutationFn: async () => {
      if (!merchantId) throw new Error("No active merchant.");
      const label = pLabel.trim();
      if (!label) throw new Error("Label is required.");
      const payload: Record<string, unknown> = {
        merchant_id: merchantId,
        label,
        model: pModel.trim() || "Generic ESC-POS",
        kind: pKind,
        supports_cash_drawer: pCashDrawer,
        is_default: pDefault,
        active: true,
      };
      if (pKind === "lan") {
        if (!pIp.trim()) throw new Error("IP address is required for a LAN printer.");
        payload.ip_address = pIp.trim();
        const port = parseInt(pPort, 10);
        payload.port = Number.isFinite(port) && port > 0 ? port : 9100;
      } else {
        if (!pCloudId.trim()) throw new Error("Cloud device id is required for a cloud printer.");
        payload.cloud_device_id = pCloudId.trim();
      }
      // If marking as default, clear the previous default first to satisfy
      // the partial unique index `printers_one_default_per_merchant`.
      if (pDefault) {
        const { error: clearErr } = await supabase
          .from("printers")
          .update({ is_default: false })
          .eq("merchant_id", merchantId)
          .eq("is_default", true);
        if (clearErr) throw clearErr;
      }
      const { error } = await supabase.from("printers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      resetPrinterForm();
      setAddPrinterOpen(false);
      qc.invalidateQueries({ queryKey: ["printers", merchantId] });
    },
    onError: (e) => setPErr((e as Error).message),
  });

  // Mutation: set a printer as the default (clearing any existing default).
  const setPrinterDefault = useMutation({
    mutationFn: async (id: string) => {
      if (!merchantId) throw new Error("No active merchant.");
      const { error: clearErr } = await supabase
        .from("printers")
        .update({ is_default: false })
        .eq("merchant_id", merchantId)
        .eq("is_default", true);
      if (clearErr) throw clearErr;
      const { error } = await supabase
        .from("printers")
        .update({ is_default: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["printers", merchantId] }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({
      table,
      id,
      active,
    }: {
      table: "devices" | "terminals" | "printers";
      id: string;
      active: boolean;
    }) => {
      const { error } = await supabase
        .from(table)
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [vars.table, merchantId] });
    },
  });

  const toggleBtn = (active: boolean) =>
    `rounded-lg px-2.5 py-1 text-xs font-medium transition ${
      active
        ? "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
        : "border border-brand-600 bg-brand-600 text-white hover:bg-brand-700"
    }`;

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Devices</h1>

      {/* Devices */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Devices</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {devicesQ.isLoading ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : devicesQ.error ? (
            <p className="p-6 text-sm text-red-600">
              {(devicesQ.error as Error).message}
            </p>
          ) : (devicesQ.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No devices registered.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Kind</th>
                  <th className="px-4 py-2 font-medium">Boot mode</th>
                  <th className="px-4 py-2 font-medium">App version</th>
                  <th className="px-4 py-2 font-medium">Last seen</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(devicesQ.data ?? []).map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {d.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{d.kind}</td>
                    <td className="px-4 py-3 text-slate-600">{d.boot_mode}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {d.app_version ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {fmtDate(d.last_seen_at)}
                    </td>
                    <td className="px-4 py-3">
                      <ActiveBadge active={d.active} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={toggleActive.isPending}
                        onClick={() =>
                          toggleActive.mutate({
                            table: "devices",
                            id: d.id,
                            active: !d.active,
                          })
                        }
                        className={toggleBtn(d.active)}
                      >
                        {d.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </section>

      {/* Card terminals */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Card terminals</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {terminalsQ.isLoading ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : terminalsQ.error ? (
            <p className="p-6 text-sm text-red-600">
              {(terminalsQ.error as Error).message}
            </p>
          ) : (terminalsQ.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No card terminals.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Label</th>
                  <th className="px-4 py-2 font-medium">Provider</th>
                  <th className="px-4 py-2 font-medium">EPI</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(terminalsQ.data ?? []).map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {t.label}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.provider}</td>
                    <td className="px-4 py-3 text-slate-600">{t.epi ?? "—"}</td>
                    <td className="px-4 py-3">
                      <ActiveBadge active={t.active} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={toggleActive.isPending}
                        onClick={() =>
                          toggleActive.mutate({
                            table: "terminals",
                            id: t.id,
                            active: !t.active,
                          })
                        }
                        className={toggleBtn(t.active)}
                      >
                        {t.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </section>

      {/* Printers */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Printers</h2>
          <button
            type="button"
            onClick={() => { setAddPrinterOpen((v) => !v); setPErr(null); }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {addPrinterOpen ? "Cancel" : "+ Add printer"}
          </button>
        </div>

        {addPrinterOpen ? (
          <form
            onSubmit={(e) => { e.preventDefault(); addPrinter.mutate(); }}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-400">Label</span>
                <input
                  value={pLabel}
                  onChange={(e) => setPLabel(e.target.value)}
                  placeholder="Front counter"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-400">Model</span>
                <input
                  value={pModel}
                  onChange={(e) => setPModel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-wide text-slate-400">Connection</span>
                <select
                  value={pKind}
                  onChange={(e) => setPKind(e.target.value as "lan" | "cloud")}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                >
                  <option value="lan">LAN (direct IP)</option>
                  <option value="cloud">Cloud (Epson SDP)</option>
                </select>
              </label>
              {pKind === "lan" ? (
                <>
                  <label className="block text-sm">
                    <span className="text-xs uppercase tracking-wide text-slate-400">IP address</span>
                    <input
                      value={pIp}
                      onChange={(e) => setPIp(e.target.value)}
                      placeholder="192.168.1.50"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Port</span>
                    <input
                      value={pPort}
                      onChange={(e) => setPPort(e.target.value)}
                      placeholder="9100"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                    />
                  </label>
                </>
              ) : (
                <label className="block text-sm sm:col-span-2">
                  <span className="text-xs uppercase tracking-wide text-slate-400">Cloud device id</span>
                  <input
                    value={pCloudId}
                    onChange={(e) => setPCloudId(e.target.value)}
                    placeholder="epson-sdp-…"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  />
                </label>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={pCashDrawer} onChange={(e) => setPCashDrawer(e.target.checked)} className="h-4 w-4 accent-brand-600" />
                <span className="text-slate-600">Has cash drawer</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={pDefault} onChange={(e) => setPDefault(e.target.checked)} className="h-4 w-4 accent-brand-600" />
                <span className="text-slate-600">Set as default</span>
              </label>
            </div>
            {pErr ? <p className="text-sm text-red-600">{pErr}</p> : null}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={addPrinter.isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {addPrinter.isPending ? "Saving…" : "Add printer"}
              </button>
              <button
                type="button"
                onClick={() => { setAddPrinterOpen(false); resetPrinterForm(); }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {printersQ.isLoading ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : printersQ.error ? (
            <p className="p-6 text-sm text-red-600">
              {(printersQ.error as Error).message}
            </p>
          ) : (printersQ.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No printers.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Label</th>
                  <th className="px-4 py-2 font-medium">Model</th>
                  <th className="px-4 py-2 font-medium">Connection</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(printersQ.data ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        <span>{p.label}</span>
                        {p.is_default ? (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Default</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.model}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.kind === "cloud" ? "Cloud" : `LAN · ${p.ip_address ?? "—"}${p.port ? `:${p.port}` : ""}`}
                    </td>
                    <td className="px-4 py-3">
                      <ActiveBadge active={p.active} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!p.is_default ? (
                          <button
                            type="button"
                            disabled={setPrinterDefault.isPending}
                            onClick={() => setPrinterDefault.mutate(p.id)}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Set as default
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={toggleActive.isPending}
                          onClick={() =>
                            toggleActive.mutate({
                              table: "printers",
                              id: p.id,
                              active: !p.active,
                            })
                          }
                          className={toggleBtn(p.active)}
                        >
                          {p.active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
