import Link from "next/link";
import {
  UserPlus,
  UtensilsCrossed,
  LayoutGrid,
  CreditCard,
  Rocket,
  ArrowRight,
  Download as DownloadIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";
import { APP_SIGNUP_URL } from "@/lib/appUrl";

export const metadata = { title: "How it works — Squarely" };

type Step = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const steps: Step[] = [
  {
    icon: UserPlus,
    title: "Create your account",
    description: "Sign up in seconds — and your store is ready to go.",
  },
  {
    icon: UtensilsCrossed,
    title: "Add your menu",
    description: "Build out items, photos, categories, and modifiers your way.",
  },
  {
    icon: LayoutGrid,
    title: "Pick your modes",
    description:
      "POS register, self-order Kiosk, Kitchen Display, Back-office — toggle on exactly what you need.",
  },
  {
    icon: CreditCard,
    title: "Connect payments",
    description:
      "Link your processor — Stripe, Square, and more — and set up sales tax.",
  },
  {
    icon: Rocket,
    title: "Go live",
    description:
      "Start taking orders and track everything across your business in real time.",
  },
];

export default function HowItWorks() {
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
        <div className="relative mx-auto max-w-3xl px-6 pb-28 pt-28 text-center">
          <Reveal>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-brand-300/80">
              How it works
            </p>
            <h1 className="mx-auto mt-7 max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">
              Up and running in{" "}
              <span className="animate-gradient bg-gradient-to-r from-brand-300 via-brand-400 to-brand-200 bg-[length:200%_auto] bg-clip-text text-transparent">
                minutes
              </span>
              .
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-slate-300">
              From sign-up to your first sale in five simple steps. No installers,
              no consultants — just your store, ready to run.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <a href={APP_SIGNUP_URL}>
                <span className="group inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-lg">
                  Create your account
                  <ArrowRight
                    size={16}
                    className="transition group-hover:translate-x-0.5"
                  />
                </span>
              </a>
              <Link
                href="/download"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10"
              >
                <DownloadIcon size={16} />
                Get the app
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── STEPS ───────── */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <div className="relative">
          {/* vertical connector line */}
          <div
            className="pointer-events-none absolute left-[1.625rem] top-6 bottom-6 hidden w-px bg-gradient-to-b from-brand-200 via-brand-200 to-transparent sm:block"
            aria-hidden="true"
          />

          <ol className="space-y-5">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title}>
                  <Reveal delay={i * 80}>
                    <div className="group relative flex items-start gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg md:p-7">
                      {/* numbered badge */}
                      <div className="relative z-10 flex h-14 w-14 flex-none flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
                        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-brand-100/80">
                          Step
                        </span>
                        <span className="text-lg font-black leading-none">
                          {i + 1}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                            <Icon size={18} />
                          </span>
                          <h2 className="text-lg font-bold tracking-tight text-slate-900 md:text-xl">
                            {step.title}
                          </h2>
                        </div>
                        <p className="mt-3 text-slate-600">{step.description}</p>
                      </div>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ───────── CLOSING CTA ───────── */}
      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <Reveal>
          <div className="grain relative overflow-hidden rounded-3xl bg-slate-950 px-8 py-14 md:px-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(51,163,255,0.22),transparent_70%)]" />
            <div className="relative z-10">
              <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                Ready when you are.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-slate-300">
                Create your free Squarely account and set up your store in
                minutes — then download the app on every device.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a href={APP_SIGNUP_URL}>
                  <span className="group inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-lg">
                    Get started free
                    <ArrowRight
                      size={16}
                      className="transition group-hover:translate-x-0.5"
                    />
                  </span>
                </a>
                <Link
                  href="/download"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10"
                >
                  <DownloadIcon size={16} />
                  Download the app
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </main>
  );
}
