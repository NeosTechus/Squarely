"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import Reveal from "@/components/Reveal";

interface OrderRow {
  id: string;
  number: number;
  status: string;
  source: string;
  total_cents: number;
  payment_status: string;
  created_at: string;
}

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

export default function Orders() {
  const qc = useQueryClient();
  const { data: merchantId } = useActiveMerchant();
  const supabase = createBrowserClient() as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args?: any) => Promise<{ data: any; error: any }>;
    auth: { getSession: () => Promise<{ data: { session: { access_token: string } | null } }> };
  };
  const [error, setError] = useState<string | null>(null);
  const [emailTarget, setEmailTarget] = useState<OrderRow | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [emailSending, setEmailSending] = useState(false);

  const { data: features } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["merchant-features-flags", merchantId],
    queryFn: async (): Promise<{ email_receipts: boolean }> => {
      const { data } = await supabase
        .from("merchant_features")
        .select("email_receipts")
        .eq("merchant_id", merchantId)
        .maybeSingle();
      return { email_receipts: (data?.email_receipts as boolean | undefined) ?? true };
    },
  });

  const openEmail = (o: OrderRow) => {
    setEmailTarget(o);
    setEmailDraft("");
    setEmailMsg(null);
  };
  const sendEmail = async () => {
    if (!emailTarget) return;
    setEmailSending(true);
    setEmailMsg(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setEmailSending(false);
      setEmailMsg({ ok: false, text: "Not signed in." });
      return;
    }
    const res = await fetch("/api/receipts/email", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: emailTarget.id, email: emailDraft.trim() }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setEmailSending(false);
    if (res.ok && body.ok) {
      setEmailMsg({ ok: true, text: "Sent." });
      setTimeout(() => setEmailTarget(null), 800);
    } else {
      setEmailMsg({ ok: false, text: body.error ?? `HTTP ${res.status}` });
    }
  };

  const { data: orders = [], isLoading, error: loadError } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["orders", merchantId],
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, number, status, source, total_cents, payment_status, created_at")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const voidOrder = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("void_order", { p_order_id: id });
      if (error) throw new Error(error.message);
      if (data && data !== "ok") throw new Error(data as string);
    },
    onSuccess: () => { setError(null); qc.invalidateQueries({ queryKey: ["orders", merchantId] }); },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <div className="space-y-6">
      <Reveal as="h1" className="text-2xl font-bold tracking-tight">
        Orders
      </Reveal>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Reveal className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {isLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : loadError ? (
          <p className="p-6 text-sm text-red-600">{(loadError as Error).message}</p>
        ) : orders.length === 0 ? (
          <p className="p-6 text-sm text-slate-600">
            No orders yet. Charge a sale on the POS app and it will show here.
          </p>
        ) : (
          <>
          {/* Desktop / tablet: table */}
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Order</th>
                <th className="px-6 py-3">Source</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Payment</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-right">Time</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => {
                const voided = o.status === "cancelled";
                return (
                  <tr key={o.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium">#{o.number}</td>
                    <td className="px-6 py-3 text-slate-600">{o.source}</td>
                    <td className="px-6 py-3 text-slate-600">{o.status}</td>
                    <td className="px-6 py-3 text-slate-600">{o.payment_status}</td>
                    <td className="px-6 py-3 text-right font-semibold">{fmt(o.total_cents)}</td>
                    <td className="px-6 py-3 text-right text-slate-500">
                      {new Date(o.created_at).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {features?.email_receipts ? (
                          <button
                            onClick={() => openEmail(o)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Email
                          </button>
                        ) : null}
                        {voided ? (
                          <span className="text-xs text-slate-400">voided</span>
                        ) : (
                          <button
                            onClick={() => {
                              if (confirm(`Void / refund order #${o.number}? This restores stock and cannot be undone.`)) {
                                voidOrder.mutate(o.id);
                              }
                            }}
                            disabled={voidOrder.isPending}
                            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Void / Refund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {/* Mobile: stacked cards */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {orders.map((o) => {
              const voided = o.status === "cancelled";
              return (
                <li key={o.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">#{o.number}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {new Date(o.created_at).toLocaleTimeString()} · {o.source}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold">{fmt(o.total_cents)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-600">
                      {o.status} · {o.payment_status}
                    </span>
                    <div className="flex items-center gap-2">
                      {features?.email_receipts ? (
                        <button
                          onClick={() => openEmail(o)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Email
                        </button>
                      ) : null}
                      {voided ? (
                        <span className="text-xs text-slate-400">voided</span>
                      ) : (
                        <button
                          onClick={() => {
                            if (confirm(`Void / refund order #${o.number}? This restores stock and cannot be undone.`)) {
                              voidOrder.mutate(o.id);
                            }
                          }}
                          disabled={voidOrder.isPending}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Void / Refund
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </Reveal>

      {emailTarget ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setEmailTarget(null)}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold">Email receipt</h3>
            <p className="mb-3 text-xs text-slate-500">
              Send the receipt for order #{emailTarget.number} ({fmt(emailTarget.total_cents)}) to:
            </p>
            <input
              type="email"
              autoFocus
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="customer@example.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
            />
            {emailMsg ? (
              <p className={`mt-2 text-sm ${emailMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{emailMsg.text}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEmailTarget(null)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={sendEmail}
                disabled={emailSending || !isEmail(emailDraft.trim())}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {emailSending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
