import Link from "next/link";
import { Button } from "@squarely/ui-web";
import { Check, Minus, Star } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";

interface Tier {
  name: string;
  price: number | null;
  blurb: string;
  cta: string;
  features: string[];
  missing: string[];
  highlighted?: boolean;
}

const tiers: Tier[] = [
  {
    name: "Starter",
    price: 0,
    blurb: "Run a single POS register. Free forever.",
    cta: "Start free",
    features: ["1 device", "POS register", "Basic inventory", "Email receipts"],
    missing: ["Kiosk mode", "Kitchen Display", "Loyalty", "Multi-location"],
  },
  {
    name: "Growth",
    price: 29,
    blurb: "Add a self-order kiosk and grow.",
    cta: "Choose Growth",
    features: ["3 devices", "POS + Kiosk", "Full inventory", "Custom receipts"],
    missing: ["Kitchen Display", "Loyalty", "Advanced reports"],
    highlighted: true,
  },
  {
    name: "Pro",
    price: 79,
    blurb: "Everything for restaurants & multi-location.",
    cta: "Choose Pro",
    features: [
      "10 devices",
      "KDS",
      "Loyalty + customers",
      "Multi-location",
      "Advanced reports",
    ],
    missing: ["API access", "White-label"],
  },
  {
    name: "Enterprise",
    price: null,
    blurb: "API access, white-label, custom terms.",
    cta: "Talk to sales",
    features: [
      "Unlimited devices",
      "API access",
      "White-label",
      "Priority support",
      "Custom integrations",
    ],
    missing: [],
  },
] as const;

export default function Pricing() {
  return (
    <main className="min-h-screen bg-white">
      <SiteNav />

      {/* ───────── HEADER ───────── */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="animate-blob pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand-600/30 blur-3xl" />
        <div
          className="animate-blob pointer-events-none absolute -right-40 top-10 h-[30rem] w-[30rem] rounded-full bg-brand-500/20 blur-3xl"
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
        <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-20 text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-brand-100 backdrop-blur">
              <span className="flex h-1.5 w-1.5 rounded-full bg-brand-400" />
              Simple, transparent pricing
            </span>
            <h1 className="mx-auto mt-7 max-w-2xl text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl">
              Plans that{" "}
              <span className="animate-gradient bg-gradient-to-r from-brand-300 via-brand-400 to-brand-200 bg-[length:200%_auto] bg-clip-text text-transparent">
                grow with you
              </span>
              .
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-slate-300">
              Start free, scale as you grow. Cancel anytime — no card required.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ───────── TIERS ───────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-stretch gap-6 md:grid-cols-4">
          {tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 80} className="flex">
              <div
                className={`group relative flex w-full flex-col rounded-2xl border bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg ${
                  t.highlighted
                    ? "border-brand-600 shadow-lg ring-2 ring-brand-600 md:scale-[1.03]"
                    : "border-slate-200 hover:border-brand-300"
                }`}
              >
                {t.highlighted && (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                    <Star size={12} className="fill-white" />
                    Most popular
                  </span>
                )}
                <div className="text-lg font-semibold text-slate-900">{t.name}</div>
                <div className="mt-2">
                  {t.price === null ? (
                    <span className="text-3xl font-bold text-slate-900">Custom</span>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-slate-900">${t.price}</span>
                      <span className="text-sm text-slate-600">/mo</span>
                    </>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600">{t.blurb}</p>
                <ul className="mt-6 flex-1 space-y-2 text-sm text-slate-700">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {f}
                    </li>
                  ))}
                  {t.missing.map((m) => (
                    <li key={m} className="flex items-start gap-2 text-slate-400">
                      <Minus className="mt-0.5 h-4 w-4 shrink-0" />
                      {m}
                    </li>
                  ))}
                </ul>
                <Link href={t.price === null ? "/contact" : "/signup"} className="mt-6">
                  <Button className="w-full" variant={t.highlighted ? "primary" : "outline"}>
                    {t.cta}
                  </Button>
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
