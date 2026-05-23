"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";

interface AuditRow {
  action: string;
  detail: string | null;
  created_at: string;
  merchant_id: string | null;
  merchants: { name: string } | { name: string }[] | null;
}

const merchantName = (m: AuditRow["merchants"]): string | null => {
  if (!m) return null;
  return Array.isArray(m) ? (m[0]?.name ?? null) : m.name;
};

export default function AuditPage() {
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await supabase
        .from("admin_audit")
        .select("action, detail, created_at, merchant_id, merchants(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>

      {error ? (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      ) : isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">No audit events yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">{r.action}</td>
                  <td className="px-4 py-3 text-slate-600">{merchantName(r.merchants) ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{r.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
