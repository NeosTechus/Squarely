"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@squarely/ui-web";
import { createBrowserClient as getBrowserSupabase } from "@squarely/db/browser";
import { signUpMerchant } from "../actions";
import { GoogleButton } from "@/components/GoogleButton";
import { AuthField } from "@/components/AuthField";
import { MARKETING_URL } from "@/lib/marketingUrl";

export default function Signup() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
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

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-3xl bg-white px-8 py-10 shadow-2xl sm:px-10">
      <h1 className="text-center text-4xl font-bold tracking-tight text-slate-900">Sign up</h1>
      <p className="mx-auto mt-3 max-w-xs text-center text-slate-500">
        Start your free Squarely store in minutes.
      </p>

      {/* Consent gates both sign-up methods below. */}
      <label className="mt-8 flex items-start gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
        />
        <span>
          I agree to the{" "}
          <a href={`${MARKETING_URL}/terms`} target="_blank" rel="noreferrer" className="text-brand-700 underline">Terms of Service</a>{" "}
          and{" "}
          <a href={`${MARKETING_URL}/privacy`} target="_blank" rel="noreferrer" className="text-brand-700 underline">Privacy Policy</a>.
        </span>
      </label>

      <div className="mt-5">
        <GoogleButton label="Sign up with Google" disabled={!agreed} />
      </div>

      <form className="mt-6 space-y-5" onSubmit={onSubmit}>
        <AuthField label="Business name" value={businessName} onChange={setBusinessName} required />
        <AuthField label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
        <AuthField label="Password" type="password" value={password} onChange={setPassword} required minLength={8} autoComplete="new-password" />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" size="lg" className="w-full" disabled={loading || !agreed}>
          {loading ? "Creating…" : "Create store"}
        </Button>
      </form>
      <p className="mt-2 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
