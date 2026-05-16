import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";

export default function Signup() {
  return (
    <main className="min-h-screen">
      <SiteNav />
      <section className="mx-auto max-w-md px-6 pt-20">
        <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-700 underline">Log in</Link>
        </p>
        <p className="mt-12 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          Signup form will live here in Phase 1 — wired to Supabase Auth and the
          merchant-create wizard. Stripe Checkout opens after plan selection.
        </p>
      </section>
    </main>
  );
}
