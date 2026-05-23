"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@squarely/ui-web";
import { createBrowserClient as getBrowserSupabase } from "@squarely/db/browser";
import { AuthField } from "@/components/AuthField";

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
    <div className="w-full max-w-md rounded-3xl bg-white px-8 py-10 shadow-2xl sm:px-10">
      <h1 className="text-center text-4xl font-bold tracking-tight text-slate-900">Reset password</h1>

      {sent ? (
        <>
          <p className="mt-3 text-center text-slate-500">
            Check your email for a reset link. It may take a minute to arrive.
          </p>
          <p className="mt-8 text-center text-sm text-slate-600">
            <Link href="/login" className="font-medium text-brand-700 hover:underline">Back to log in</Link>
          </p>
        </>
      ) : (
        <>
          <p className="mx-auto mt-3 max-w-xs text-center text-slate-500">
            Enter your email and we&apos;ll send you a reset link.
          </p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            <AuthField label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-600">
            <Link href="/login" className="font-medium text-brand-700 hover:underline">Back to log in</Link>
          </p>
        </>
      )}
    </div>
  );
}
