"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@squarely/db/browser";

type FeatureKey = "pos" | "kiosk" | "kds" | "admin";
const FEATURES: { key: FeatureKey; label: string }[] = [
  { key: "pos", label: "POS" },
  { key: "kiosk", label: "Kiosk" },
  { key: "kds", label: "KDS (chef)" },
  { key: "admin", label: "Admin" },
];

interface MerchantRow {
  id: string;
  name: string;
  slug: string;
  email: string;
  merchant_features: Record<FeatureKey, boolean> | null;
}

export default function AdminConsole() {
  const router = useRouter();
  const qc = useQueryClient();
  const supabase = createBrowserClient() as unknown as { from: (t: string) => any };

  const { data: merchants = [], isLoading, error } = useQuery({
    queryKey: ["admin-merchants"],
    queryFn: async (): Promise<MerchantRow[]> => {
      const { data, error } = await supabase
        .from("merchants")
        .select("id, name, slug, email, merchant_features(pos, kiosk, kds, admin)")
        .order("name");
      if (error) throw error;
      // Supabase embeds a 1:1 relation as an array; flatten it.
      return (data ?? []).map((m: any) => ({
        ...m,
        merchant_features: Array.isArray(m.merchant_features)
          ? m.merchant_features[0] ?? null
          : m.merchant_features,
      }));
    },
  });

  const toggle = useMutation({
    mutationFn: async (args: { merchantId: string; key: FeatureKey; value: boolean }) => {
      const { error } = await supabase
        .from("merchant_features")
        .update({ [args.key]: args.value, updated_at: new Date().toISOString() })
        .eq("merchant_id", args.merchantId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-merchants"] }),
  });

  async function signOut() {
    await createBrowserClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold">Squarely · Platform Admin</h1>
          <p className="text-xs text-slate-500">Manage every merchant and their enabled features</p>
        </div>
        <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-800">
          Sign out
        </button>
      </header>

      <main className="px-6 py-6">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading merchants…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{(error as Error).message}</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Merchant</th>
                  <th className="px-6 py-3">Email</th>
                  {FEATURES.map((f) => (
                    <th key={f.key} className="px-4 py-3 text-center">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {merchants.map((m) => (
                  <tr key={m.id}>
                    <td className="px-6 py-3">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-slate-400">{m.slug}</div>
                    </td>
                    <td className="px-6 py-3 text-slate-600">{m.email}</td>
                    {FEATURES.map((f) => {
                      const on = m.merchant_features?.[f.key] ?? true;
                      return (
                        <td key={f.key} className="px-4 py-3 text-center">
                          <button
                            onClick={() =>
                              toggle.mutate({ merchantId: m.id, key: f.key, value: !on })
                            }
                            disabled={toggle.isPending}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                              on ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                            aria-label={`${f.label} ${on ? "on" : "off"}`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                on ? "translate-x-5" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
