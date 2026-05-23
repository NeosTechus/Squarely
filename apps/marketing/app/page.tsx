import Link from "next/link";
import { Button } from "@squarely/ui-web";
import {
  ShoppingBag,
  Smartphone,
  Tv2,
  Boxes,
  Users,
  BadgeCheck,
  Printer,
  CreditCard,
  ArrowRight,
  Check,
  Star,
} from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { APP_SIGNUP_URL } from "@/lib/appUrl";
import Reveal from "@/components/Reveal";
import Marquee from "@/components/Marquee";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <SiteNav />

      {/* ───────── HERO ───────── */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="animate-blob pointer-events-none absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand-600/30 blur-3xl" />
        <div className="animate-blob pointer-events-none absolute -right-40 top-20 h-[34rem] w-[34rem] rounded-full bg-brand-500/20 blur-3xl" style={{ animationDelay: "-4s" }} />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-6 pb-28 pt-20 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-brand-100 backdrop-blur">
            <span className="flex h-1.5 w-1.5 rounded-full bg-brand-400" />
            The all-in-one commerce platform · iOS · Android · Web
          </span>
          <h1 className="mx-auto mt-7 max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-7xl">
            Run your entire business
            <br />
            <span className="animate-gradient bg-gradient-to-r from-brand-300 via-brand-400 to-brand-200 bg-[length:200%_auto] bg-clip-text text-transparent">
              from a single screen.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
            POS, self-order kiosk, kitchen display, inventory, customers, and reporting — unified in
            one platform. Hardware-ready, multi-location, and built to scale. The modern alternative
            to Square and Clover.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a href={APP_SIGNUP_URL}>
              <Button size="lg" className="gap-2">
                Start free <ArrowRight size={18} />
              </Button>
            </a>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                See pricing
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">No card required · Free Starter plan · Set up in minutes</p>

          {/* Product mockup */}
          <div className="animate-floaty relative mx-auto mt-16 max-w-5xl">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-2 shadow-2xl backdrop-blur">
              <div className="overflow-hidden rounded-xl bg-white">
                <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-3 text-xs text-slate-400">Squarely · Point of Sale</span>
                </div>
                <div className="grid grid-cols-1 gap-4 p-5 text-left md:grid-cols-3">
                  <div className="md:col-span-2">
                    <div className="mb-3 h-3 w-24 rounded bg-slate-200" />
                    <div className="grid grid-cols-3 gap-3">
                      {["Espresso", "Latte", "Cold Brew", "Croissant", "Avocado Toast", "Mocha"].map((n, i) => (
                        <div key={n} className="rounded-xl border border-slate-200 p-3">
                          <div className={`mb-2 h-12 rounded-lg bg-gradient-to-br ${["from-amber-100 to-amber-200", "from-sky-100 to-sky-200", "from-indigo-100 to-indigo-200", "from-rose-100 to-rose-200", "from-emerald-100 to-emerald-200", "from-fuchsia-100 to-fuchsia-200"][i]}`} />
                          <div className="text-xs font-semibold text-slate-700">{n}</div>
                          <div className="text-[11px] text-slate-400">${(3.5 + i).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-700">Cart</div>
                    <div className="mt-3 space-y-2">
                      {["Latte", "Croissant"].map((n) => (
                        <div key={n} className="flex justify-between text-xs text-slate-600">
                          <span>1 × {n}</span>
                          <span className="font-medium">$4.75</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 border-t border-slate-200 pt-3">
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Total</span>
                        <span>$8.70</span>
                      </div>
                      <div className="mt-3 rounded-lg bg-brand-600 py-2 text-center text-sm font-semibold text-white">
                        Charge
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── TRUST STRIP ───────── */}
      <section className="border-b border-slate-100 bg-white py-10">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Built for cafés · restaurants · retail · food trucks · franchises
          </p>
          <Marquee className="mt-6 text-lg font-bold text-slate-300">
            <span className="mx-6">☕ Brew &amp; Co</span>
            <span className="mx-6">🍔 Urban Eats</span>
            <span className="mx-6">🥡 Taco Five</span>
            <span className="mx-6">🍣 Sushi Express</span>
            <span className="mx-6">🥐 Bluebird</span>
          </Marquee>
        </div>
      </section>

      {/* ───────── FEATURE GRID ───────── */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight text-slate-900">Everything in one platform</h2>
          <p className="mt-4 text-lg text-slate-600">
            No more stitching together five tools. Squarely replaces your register, kiosk, kitchen
            screen, and back office.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            { icon: <ShoppingBag />, title: "Point of Sale", body: "Fast cart, modifiers, split tender, tips, and instant receipts." },
            { icon: <Smartphone />, title: "Self-order Kiosk", body: "A locked-down, branded ordering screen your customers run themselves." },
            { icon: <Tv2 />, title: "Kitchen Display", body: "Orders hit the kitchen in real time with prep timers and status." },
            { icon: <Boxes />, title: "Inventory", body: "Items, categories, modifiers, stock levels, and low-stock alerts." },
            { icon: <Users />, title: "Customers & Loyalty", body: "Directory, order history, and points to keep regulars coming back." },
            { icon: <BadgeCheck />, title: "Reports & Analytics", body: "Live revenue, top items, and trends across every location." },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <Feature icon={f.icon} title={f.title} body={f.body} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────── ALT HIGHLIGHTS ───────── */}
      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl space-y-24 px-6">
          <Reveal>
            <Highlight
              eyebrow="Point of Sale"
              title="Ring up sales in seconds"
              body="A register designed for speed. Build the cart, apply modifiers, take card or cash, and print a receipt — without the clutter."
              points={["Card readers & cash drawers", "Tips, discounts, split payments", "Offline-resilient"]}
              align="left"
            />
          </Reveal>
          <Reveal>
            <Highlight
              eyebrow="Kiosk + Kitchen"
              title="Let customers order themselves"
              body="Turn any tablet into a self-order kiosk. Orders flow straight to the kitchen display, so your team just makes and serves."
              points={["Branded welcome screen", "Real-time kitchen tickets", "Pay-at-counter or card"]}
              align="right"
            />
          </Reveal>
        </div>
      </section>

      {/* ───────── STATS ───────── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <Reveal className="grid gap-8 rounded-3xl bg-slate-950 px-8 py-12 text-center md:grid-cols-4">
          <Stat value="1 app" label="POS, Kiosk, KDS & Admin" />
          <Stat value="< 5 min" label="To set up your store" />
          <Stat value="Multi-tenant" label="Built for many locations" />
          <Stat value="iOS · Android · Web" label="Run anywhere" />
        </Reveal>
      </section>

      {/* ───────── WHY US ───────── */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight text-slate-900">Why teams switch to Squarely</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { icon: <CreditCard />, title: "Bring your own gateway", body: "Choose your payment processor — Valor, Stripe, Square, or cash. Not locked in." },
            { icon: <Printer />, title: "Hardware-ready", body: "Epson receipt printers, card readers, barcode scanners, and cash drawers." },
            { icon: <Star />, title: "Transparent pricing", body: "Plans that grow with you. Start free, upgrade when you need more." },
          ].map((w, i) => (
            <Reveal key={w.title} delay={i * 80}>
              <Why icon={w.icon} title={w.title} body={w.body} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────── CTA BAND ───────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 py-20">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <Reveal className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-white">Ready to run smarter?</h2>
          <p className="mt-4 text-lg text-brand-50">
            Start free in minutes. Add a kiosk, a kitchen screen, and more locations as you grow.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={APP_SIGNUP_URL}>
              <Button size="lg" className="bg-white text-brand-700 hover:bg-brand-50">
                Start free
              </Button>
            </a>
            <Link href="/download">
              <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                Download the app
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </main>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
        {icon}
      </div>
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}

function Highlight({
  eyebrow,
  title,
  body,
  points,
  align,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  align: "left" | "right";
}) {
  return (
    <div className="grid items-center gap-10 md:grid-cols-2">
      <div className={align === "right" ? "md:order-2" : ""}>
        <div className="text-sm font-semibold uppercase tracking-widest text-brand-600">{eyebrow}</div>
        <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{title}</h3>
        <p className="mt-4 text-slate-600">{body}</p>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-3 text-slate-700">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <Check size={13} />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={align === "right" ? "md:order-1" : ""}>
        <div className="aspect-[4/3] rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-100 p-4 shadow-sm">
          <div className="h-full w-full rounded-xl bg-white p-4 shadow-inner">
            <div className="mb-3 h-3 w-20 rounded bg-slate-200" />
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border border-slate-100 p-3">
                  <div className="mb-2 h-8 rounded bg-brand-50" />
                  <div className="h-2 w-12 rounded bg-slate-200" />
                </div>
              ))}
            </div>
            <div className="mt-3 h-9 rounded-lg bg-brand-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{label}</div>
    </div>
  );
}

function Why({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-6">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
        {icon}
      </div>
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
    </div>
  );
}
