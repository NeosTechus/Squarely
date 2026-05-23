"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@squarely/ui-web";
import { createBrowserClient as getBrowserSupabase } from "@squarely/db/browser";
import { GoogleButton } from "@/components/GoogleButton";
import { AuthField } from "@/components/AuthField";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getBrowserSupabase();
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (signInErr) {
      setError(signInErr.message);
      setLoading(false);
      return;
    }
    router.push(params.get("redirect") ?? "/");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-3xl bg-white px-8 py-10 shadow-2xl sm:px-10">
      <h1 className="text-center text-4xl font-bold tracking-tight text-slate-900">Log in</h1>
      <p className="mx-auto mt-3 max-w-xs text-center text-slate-500">
        Welcome back. Sign in to your Squarely account.
      </p>

      <div className="mt-8">
        <GoogleButton label="Log in with Google" />
      </div>

      <form className="mt-6 space-y-5" onSubmit={onSubmit}>
        <AuthField label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
        <AuthField label="Password" type="password" value={password} onChange={setPassword} required autoComplete="current-password" />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Log in"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className="text-brand-700 hover:underline">
          Forgot password?
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate-600">
        New to Squarely?{" "}
        <Link href="/signup" className="font-medium text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
