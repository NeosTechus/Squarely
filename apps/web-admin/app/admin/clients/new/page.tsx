"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { onboardMerchant } from "../actions";

const PLANS = [
  { tier: "starter", label: "Starter (Free)" },
  { tier: "growth", label: "Growth ($29/mo)" },
  { tier: "pro", label: "Pro ($79/mo)" },
  { tier: "enterprise", label: "Enterprise" },
];

export default function NewClientPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [planTier, setPlanTier] = useState("growth");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await onboardMerchant({ businessName, email, password, planTier });
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-merchants"] });
    router.push("/admin/clients");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <Link href="/admin/clients" className="text-sm text-slate-500 hover:text-slate-800">
        ← Back to clients
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Onboard a new client</h1>
      <p className="mt-1 text-sm text-slate-600">
        Creates the merchant, the owner login, and a subscription.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <Field label="Business name">
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required
            className="input" placeholder="Joe's Diner" />
        </Field>
        <Field label="Owner email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="input" placeholder="owner@joesdiner.com" />
        </Field>
        <Field label="Temporary password">
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
            className="input" placeholder="min 8 characters" />
        </Field>
        <Field label="Plan">
          <select value={planTier} onChange={(e) => setPlanTier(e.target.value)} className="input">
            {PLANS.map((p) => (
              <option key={p.tier} value={p.tier}>{p.label}</option>
            ))}
          </select>
        </Field>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button type="submit" disabled={loading}
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {loading ? "Creating…" : "Create client"}
        </button>
      </form>

      <style>{`.input{margin-top:.25rem;width:100%;border-radius:.5rem;border:1px solid rgb(203 213 225);padding:.5rem .75rem;font-size:.875rem}.input:focus{outline:none;border-color:rgb(79 70 229)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-700">{label}</span>
      {children}
    </label>
  );
}
