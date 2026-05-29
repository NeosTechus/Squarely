"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import Reveal from "@/components/Reveal";

interface Customer {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export default function Customers() {
  const qc = useQueryClient();
  const { data: merchantId } = useActiveMerchant();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // The generated Database types are empty in this scaffold, so the typed
  // query builder resolves to `never`; use an untyped client for these calls.
  const supabase = createBrowserClient() as unknown as {
    from: (t: string) => any;
  };

  const { data: customers = [], isLoading, error } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["customers", merchantId],
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, display_name, email, phone, notes, created_at")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Customer[]) ?? [];
    },
  });

  const addCustomer = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error("Enter a customer name.");
      }
      const { error } = await supabase.from("customers").insert({
        merchant_id: merchantId,
        display_name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
      setFormError(null);
      qc.invalidateQueries({ queryKey: ["customers", merchantId] });
    },
    onError: (e) => setFormError((e as Error).message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      (c.display_name ?? "").toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <div className="max-w-2xl space-y-6">
      <Reveal as="h1" className="text-2xl font-bold tracking-tight">
        Customers
      </Reveal>

      <Reveal>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addCustomer.mutate();
        }}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[10rem] flex-1 text-sm">
            <span className="text-slate-700">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
            />
          </label>
          <label className="min-w-[10rem] flex-1 text-sm">
            <span className="text-slate-700">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="jane@example.com"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[10rem] flex-1 text-sm">
            <span className="text-slate-700">Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="(555) 123-4567"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
            />
          </label>
          <label className="min-w-[10rem] flex-1 text-sm">
            <span className="text-slate-700">Notes</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VIP, allergies, etc."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={addCustomer.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {addCustomer.isPending ? "Adding…" : "Add customer"}
          </button>
        </div>
      </form>
      </Reveal>
      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

      <label className="block text-sm">
        <span className="sr-only">Search</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
        />
      </label>

      <Reveal className="rounded-2xl border border-slate-200 bg-white">
        {isLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">{(error as Error).message}</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            {customers.length === 0
              ? "No customers yet — add your first above."
              : "No customers match your search."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <li key={c.id} className="px-4 py-3 transition hover:bg-slate-50 sm:px-6">
                <p className="truncate font-medium">
                  {c.display_name ?? "Unnamed customer"}
                </p>
                <p className="truncate text-sm text-slate-500">
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                </p>
                {c.notes ? (
                  <p className="mt-1 break-words text-sm text-slate-400">{c.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </div>
  );
}
