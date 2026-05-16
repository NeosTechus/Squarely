import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";

export default function Login() {
  return (
    <main className="min-h-screen">
      <SiteNav />
      <section className="mx-auto max-w-md px-6 pt-20">
        <h1 className="text-3xl font-bold tracking-tight">Log in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Don't have an account?{" "}
          <Link href="/signup" className="text-brand-700 underline">Sign up</Link>
        </p>
        <p className="mt-12 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          Login form will live here in Phase 1 — Supabase Auth (email magic link, Google, Apple).
        </p>
      </section>
    </main>
  );
}
