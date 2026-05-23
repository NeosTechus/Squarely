"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@squarely/ui-web";
import { createBrowserClient as getBrowserSupabase } from "@squarely/db/browser";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getBrowserSupabase();
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: window.location.origin + "/reset-password" },
    );
    if (resetErr) {
      setError(resetErr.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>

        {sent ? (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Check your email for a link to reset your password. It may take a
              minute to arrive.
            </p>
            <p className="mt-6 text-center text-sm text-slate-600">
              <Link href="/login" className="text-brand-700 underline">
                Back to log in
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-slate-600">
              <Link href="/login" className="text-brand-700 underline">
                Back to log in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
