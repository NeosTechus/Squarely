"use client";

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
  ip_address: string | null;
  serial: string | null;
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
        .select("id, label, model, ip_address, serial, supports_cash_drawer, active")
        .eq("merchant_id", merchantId)
        .order("label");
      if (error) throw error;
      return (data as Printer[]) ?? [];
    },
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
        <h2 className="text-lg font-semibold text-slate-800">Printers</h2>
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
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Label</th>
                  <th className="px-4 py-2 font-medium">Model</th>
                  <th className="px-4 py-2 font-medium">IP address</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(printersQ.data ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {p.label}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.model}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.ip_address ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ActiveBadge active={p.active} />
                    </td>
                    <td className="px-4 py-3 text-right">
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
