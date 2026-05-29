"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@squarely/db/browser";
import { useActiveMerchant } from "@/lib/useActiveMerchant";
import { addTeamMember } from "./actions";
import { MERCHANT_ROLES, type MerchantRole } from "./roles";

interface Member {
  id: string;
  display_name: string | null;
  role: MerchantRole;
  active: boolean;
}

export default function Team() {
  const qc = useQueryClient();
  const { data: merchantId } = useActiveMerchant();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<MerchantRole>("cashier");
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  // The generated Database types are empty in this scaffold, so the typed
  // query builder resolves to `never`; use an untyped client for these calls.
  const supabase = createBrowserClient() as unknown as {
    from: (t: string) => any;
  };

  const {
    data: members = [],
    isLoading,
    error,
  } = useQuery({
    enabled: Boolean(merchantId),
    queryKey: ["team-members", merchantId],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from("merchant_members")
        .select("id, display_name, role, active")
        .eq("merchant_id", merchantId)
        .order("created_at");
      if (error) throw error;
      return (data as Member[]) ?? [];
    },
  });

  const addMember = useMutation({
    mutationFn: async () => {
      if (!merchantId) throw new Error("No active store.");
      const res = await addTeamMember({
        email,
        password,
        displayName,
        role,
        merchantId,
      });
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => {
      setFormError(null);
      setFormOk(`Added ${displayName.trim() || email.trim()}.`);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setRole("cashier");
      qc.invalidateQueries({ queryKey: ["team-members", merchantId] });
    },
    onError: (e) => {
      setFormOk(null);
      setFormError((e as Error).message);
    },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Team</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          addMember.mutate();
        }}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <div className="flex flex-wrap gap-3">
          <label className="flex-1 text-sm">
            <span className="text-slate-700">Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jane Doe"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
            />
          </label>
          <label className="w-40 text-sm">
            <span className="text-slate-700">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MerchantRole)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 capitalize focus:border-brand-600 focus:outline-none"
            >
              {MERCHANT_ROLES.map((r) => (
                <option key={r} value={r} className="capitalize">
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex-1 text-sm">
            <span className="text-slate-700">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="jane@example.com"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
            />
          </label>
          <label className="flex-1 text-sm">
            <span className="text-slate-700">Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="At least 8 characters"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={addMember.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {addMember.isPending ? "Adding…" : "Add staff member"}
        </button>
      </form>
      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      {formOk ? <p className="text-sm text-green-600">{formOk}</p> : null}

      <div className="rounded-2xl border border-slate-200 bg-white">
        {isLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">{(error as Error).message}</p>
        ) : members.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No team members yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-4 px-4 py-3 sm:px-6">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {m.display_name || "—"}
                </span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
                  {m.role}
                </span>
                <span
                  className={`w-20 shrink-0 text-right text-xs font-medium ${
                    m.active ? "text-green-600" : "text-slate-400"
                  }`}
                >
                  {m.active ? "Active" : "Inactive"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
