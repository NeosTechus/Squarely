import Link from "next/link";
import { Apple, Play, ArrowRight } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";

export default function Download() {
  return (
    <main className="min-h-screen bg-white">
      <SiteNav />

      {/* ───────── HERO ───────── */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="animate-blob pointer-events-none absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-brand-600/30 blur-3xl" />
        <div
          className="animate-blob pointer-events-none absolute -right-40 top-10 h-[32rem] w-[32rem] rounded-full bg-brand-500/20 blur-3xl"
          style={{ animationDelay: "-4s" }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-6 pb-28 pt-20 text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-brand-100 backdrop-blur">
              <span className="flex h-1.5 w-1.5 rounded-full bg-brand-400" />
              iOS · Android · phone · tablet · register
            </span>
            <h1 className="mx-auto mt-7 max-w-2xl text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl">
              Get{" "}
              <span className="animate-gradient bg-gradient-to-r from-brand-300 via-brand-400 to-brand-200 bg-[length:200%_auto] bg-clip-text text-transparent">
                Squarely
              </span>{" "}
              on every device.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-slate-300">
              Available on iOS and Android — run your register, kiosk, and kitchen
              display from the hardware you already have.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="https://apps.apple.com/app/squarely"
                className="group inline-flex items-center gap-3 rounded-xl bg-white px-6 py-3 text-left text-slate-900 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <Apple className="h-7 w-7" />
                <span className="leading-tight">
                  <span className="block text-[11px] text-slate-500">Download on the</span>
                  <span className="block text-base font-semibold">App Store</span>
                </span>
              </Link>
              <Link
                href="https://play.google.com/store/apps/details?id=com.squarely"
                className="group inline-flex items-center gap-3 rounded-xl bg-white px-6 py-3 text-left text-slate-900 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <Play className="h-7 w-7" />
                <span className="leading-tight">
                  <span className="block text-[11px] text-slate-500">Get it on</span>
                  <span className="block text-base font-semibold">Google Play</span>
                </span>
              </Link>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <p className="mt-8 text-sm text-slate-400">
              After installing, sign in with your Squarely account or create one to
              onboard your store.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ───────── NEXT STEPS ───────── */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <Reveal>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              No account yet?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-slate-600">
              Create a free Squarely account and set up your store in minutes — then
              sign in on the app.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Create your account <ArrowRight size={16} />
            </Link>
          </div>
        </Reveal>
      </section>
      <SiteFooter />
    </main>
  );
}
