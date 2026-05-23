import Link from "next/link";
import { Button } from "@squarely/ui-web";
import { Check, Minus } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

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
    <main className="min-h-screen">
      <SiteNav />
      <section className="px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Pricing</h1>
        <p className="mt-3 text-slate-600">Start free, scale as you grow. Cancel anytime.</p>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-4">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`flex flex-col rounded-2xl border p-6 ${t.highlighted ? "border-brand-600 shadow-lg" : "border-slate-200"}`}
            >
              <div className="text-lg font-semibold">{t.name}</div>
              <div className="mt-2">
                {t.price === null ? (
                  <span className="text-3xl font-bold">Custom</span>
                ) : (
                  <>
                    <span className="text-4xl font-bold">${t.price}</span>
                    <span className="text-sm text-slate-600">/mo</span>
                  </>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-600">{t.blurb}</p>
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
                    {f}
                  </li>
                ))}
                {t.missing.map((m) => (
                  <li key={m} className="flex items-start gap-2 text-slate-400">
                    <Minus className="mt-0.5 h-4 w-4" />
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
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
