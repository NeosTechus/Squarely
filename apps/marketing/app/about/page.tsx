import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "About — Squarely" };

export default function About() {
  return (
    <main className="min-h-screen bg-white">
      <SiteNav />
      <section className="grain relative overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(51,163,255,0.18),transparent_70%)]" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 pb-20 pt-28 text-center">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-brand-300/80">About</p>
          <h1 className="mt-7 text-5xl font-bold tracking-tight text-white md:text-6xl">
            Commerce software,
            <br />
            <span className="bg-gradient-to-r from-brand-300 to-brand-200 bg-clip-text text-transparent">built to scale.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-slate-300">
            Squarely brings POS, kiosk, kitchen display, and back-office into one platform — so
            growing businesses run on one system instead of five.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-6 px-6 py-16 text-slate-700">
        <p>
          We build the tools small and multi-location businesses need to sell, serve, and grow —
          without the lock-in and per-feature upsells of legacy POS vendors. One app powers the
          register, a self-order kiosk, the kitchen, and the dashboard, on the hardware you already
          have or that we set up for you.
        </p>
        <p>
          Squarely is a product of <strong>NeosTech LLC</strong> — an AI-native engineering &amp; IT
          services company building software for ambitious teams.
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}
