"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@squarely/ui-web";
import { createBrowserClient as getBrowserSupabase } from "@squarely/db/browser";
import { signUpMerchant } from "../actions";
import { GoogleButton } from "@/components/GoogleButton";

export default function Signup() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // 1. Create account + merchant on the server.
    const res = await signUpMerchant({ email, password, businessName });
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }

    // 2. Sign in in the browser so the session cookie is set.
    const supabase = getBrowserSupabase();
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (signInErr) {
      setError("Account created — please log in.");
      setLoading(false);
      router.push("/login");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-slate-600">Start your free Squarely store.</p>

        <div className="mt-6">
          <GoogleButton label="Sign up with Google" />
        </div>
        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" /> or <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="text-slate-700">Business name</span>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Create store"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-700 underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
