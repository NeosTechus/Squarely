"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@squarely/db/browser";

// Cart state schema — POS writes the same shape into cfd_state.state.
interface CartLine {
  name: string;
  quantity: number;
  unit_price_cents: number;
  modifier_summary?: string | null;
}

interface CartState {
  items?: CartLine[];
  subtotal_cents?: number;
  tax_cents?: number;
  tip_cents?: number;
  total_cents?: number;
  merchant_name?: string;
  brand_color?: string;
  message?: string;
  // Optional follow-up payment summary. POS writes this when the sale closes
  // so the customer screen flashes a "Thank you" before going idle.
  paid?: boolean;
  payment_method?: string | null;
}

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function CfdView({
  slug,
  deviceId,
}: {
  slug: string;
  deviceId: string | null;
}) {
  const [state, setState] = useState<CartState | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const supabase = createBrowserClient() as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>;
    from: (t: string) => any;
    channel: (name: string) => any;
    removeChannel: (ch: any) => void;
  };

  // Initial fetch via the public RPC (slug → state). Also pulls merchant_id
  // out of a secondary lookup so the Realtime subscription can filter on it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rpcData } = await supabase.rpc("get_cfd_state", {
        p_slug: slug,
        p_device_id: deviceId,
      });
      if (cancelled) return;
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (row) setState((row.state ?? {}) as CartState);

      // Look up merchant id from slug — the merchants table allows anon
      // SELECT only of (id, name, slug, brand_color) by RLS in init.sql, so
      // this is safe. If RLS later tightens, swap this for an RPC.
      const { data: merch } = await supabase
        .from("merchants")
        .select("id, name, brand_color")
        .eq("slug", slug)
        .maybeSingle();
      if (!cancelled && merch) {
        setMerchantId(merch.id);
        setState((prev) => ({
          ...(prev ?? {}),
          merchant_name: prev?.merchant_name ?? merch.name,
          brand_color: prev?.brand_color ?? merch.brand_color ?? "#4f46e5",
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, deviceId, supabase]);

  // Realtime subscription on cfd_state filtered by merchant_id. We poll-merge
  // on every UPDATE/INSERT so the cashier's POS push lands within ~150ms.
  useEffect(() => {
    if (!merchantId) return;
    const ch = supabase
      .channel(`cfd:${merchantId}:${deviceId ?? "shared"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cfd_state",
          filter: `merchant_id=eq.${merchantId}`,
        },
        (payload: { new?: { state?: CartState; device_id?: string | null } }) => {
          const row = payload.new;
          if (!row) return;
          // If a device id is in the URL, only accept matching writes.
          if (deviceId && row.device_id && row.device_id !== deviceId) return;
          if (row.state) setState((prev) => ({ ...(prev ?? {}), ...row.state! }));
        },
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [merchantId, deviceId, supabase]);

  const items = state?.items ?? [];
  const brand = state?.brand_color || "#4f46e5";
  const total = state?.total_cents ?? 0;
  const paid = state?.paid === true;

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-50">
      <header
        className="px-10 py-6"
        style={{ background: brand, color: "white" }}
      >
        <div className="text-3xl font-bold tracking-tight">
          {state?.merchant_name ?? "Welcome"}
        </div>
        <div className="mt-1 text-sm opacity-80">
          {paid ? "Thank you for your purchase!" : "Your order"}
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Items column */}
        <section className="flex-1 overflow-y-auto px-10 py-6">
          {items.length === 0 && !paid ? (
            <div className="flex h-full items-center justify-center text-xl text-slate-400">
              {state?.message ?? "Ready when you are."}
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {items.map((l, i) => (
                <li key={i} className="flex justify-between gap-4 py-3 text-2xl">
                  <div>
                    <div className="font-medium text-slate-900">
                      {l.quantity > 1 ? `${l.quantity} × ` : ""}
                      {l.name}
                    </div>
                    {l.modifier_summary && (
                      <div className="mt-1 text-base text-slate-500">{l.modifier_summary}</div>
                    )}
                  </div>
                  <div className="shrink-0 font-semibold text-slate-900 tabular-nums">
                    {fmt(l.unit_price_cents * l.quantity)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Totals column */}
        <aside className="w-96 shrink-0 border-l border-slate-200 bg-white px-8 py-6 text-xl">
          {state ? (
            <div className="space-y-2 text-slate-700">
              <Row label="Subtotal" value={state.subtotal_cents ?? 0} />
              {(state.tax_cents ?? 0) > 0 && <Row label="Tax" value={state.tax_cents ?? 0} />}
              {(state.tip_cents ?? 0) > 0 && <Row label="Tip" value={state.tip_cents ?? 0} />}
              <div className="mt-6 flex justify-between border-t border-slate-200 pt-4 text-3xl font-bold text-slate-900">
                <span>Total</span>
                <span className="tabular-nums" style={{ color: brand }}>
                  {fmt(total)}
                </span>
              </div>
              {paid && state.payment_method && (
                <div className="mt-6 text-center text-base uppercase tracking-widest text-slate-400">
                  Paid · {state.payment_method}
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-400">Connecting…</div>
          )}
        </aside>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="tabular-nums">{fmt(value)}</span>
    </div>
  );
}
