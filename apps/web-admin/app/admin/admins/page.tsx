"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listAdmins, addAdmin, removeAdmin } from "./actions";

export default function AdminsPage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: admins = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["platform-admins"],
    queryFn: () => listAdmins(),
  });

  const add = useMutation({
    mutationFn: async (value: string) => {
      const res = await addAdmin(value);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => {
      setEmail("");
      setFormError(null);
      qc.invalidateQueries({ queryKey: ["platform-admins"] });
    },
    onError: (e) => setFormError((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const res = await removeAdmin(userId);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-admins"] }),
    onError: (e) => setFormError((e as Error).message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Platform admins</h1>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Add an admin</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            add.mutate(email);
          }}
          className="flex flex-wrap items-center gap-3"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
            required
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={add.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {add.isPending ? "Adding…" : "Add admin"}
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          The user must already have a Squarely account.
        </p>
        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Current admins</h2>
        </div>
        {isLoading ? (
          <p className="p-5 text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="p-5 text-sm text-red-600">{(error as Error).message}</p>
        ) : admins.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">No platform admins yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {admins.map((a) => (
              <li key={a.userId} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">{a.email}</div>
                  <div className="text-xs text-slate-400">
                    Added {new Date(a.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setFormError(null);
                    remove.mutate(a.userId);
                  }}
                  disabled={remove.isPending}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
