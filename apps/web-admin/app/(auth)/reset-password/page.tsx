"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@squarely/ui-web";
import { createBrowserClient as getBrowserSupabase } from "@squarely/db/browser";
import { AuthField } from "@/components/AuthField";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // The recovery link drops the user here with a session established by the
  // Supabase client (PKCE/recovery token in the URL hash). Confirm we have one.
  useEffect(() => {
    const supabase = getBrowserSupabase();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError(
          "This reset link is invalid or has expired. Request a new one.",
        );
      }
      setReady(true);
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = getBrowserSupabase();
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-3xl bg-white px-8 py-10 shadow-2xl sm:px-10">
      <h1 className="text-center text-4xl font-bold tracking-tight text-slate-900">New password</h1>
      <p className="mx-auto mt-3 max-w-xs text-center text-slate-500">
        Choose a new password for your account.
      </p>

      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <AuthField label="New password" type="password" value={password} onChange={setPassword} required autoComplete="new-password" />
        <AuthField label="Confirm password" type="password" value={confirm} onChange={setConfirm} required autoComplete="new-password" />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" size="lg" className="w-full" disabled={loading || !ready}>
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-600">
        <Link href="/login" className="font-medium text-brand-700 hover:underline">Back to log in</Link>
      </p>
    </div>
  );
}
