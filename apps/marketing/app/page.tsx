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
  ScanLine,
  Archive,
  Wrench,
  Truck,
} from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { APP_SIGNUP_URL } from "@/lib/appUrl";
import Reveal from "@/components/Reveal";
import Marquee from "@/components/Marquee";
import CountUp from "@/components/CountUp";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <SiteNav />

      {/* ───────── HERO ───────── */}
      <section className="grain relative overflow-hidden bg-slate-950">
        {/* radial spotlight */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(51,163,255,0.18),transparent_70%)]" />
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
        <div className="relative z-10 mx-auto max-w-7xl px-6 pb-28 pt-28 text-center">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-brand-300/80">
            Point of Sale · Kiosk · Kitchen · Back office
          </p>
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
      <section className="border-b border-slate-100 bg-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            Built for cafés, restaurants, retail &amp; multi-location brands
          </p>
          <Marquee className="mt-8">
            {[
              "Brew & Co.",
              "URBAN EATS",
              "Taco Five",
              "Sushi Express",
              "Bluebird Bakery",
              "Fenton Gyro",
              "Late Night Diner",
            ].map((b) => (
              <span
                key={b}
                className="mx-9 text-xl font-semibold tracking-tight text-slate-300 transition-colors hover:text-slate-500"
              >
                {b}
              </span>
            ))}
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
              visual={<CheckoutMock />}
            />
          </Reveal>
          <Reveal>
            <Highlight
              eyebrow="Kiosk + Kitchen"
              title="Let customers order themselves"
              body="Turn any tablet into a self-order kiosk. Orders flow straight to the kitchen display, so your team just makes and serves."
              points={["Branded welcome screen", "Real-time kitchen tickets", "Pay-at-counter or card"]}
              align="right"
              visual={<KdsMock />}
            />
          </Reveal>
        </div>
      </section>

      {/* ───────── HARDWARE & SETUP ───────── */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Hardware, handled</div>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
            We supply the gear — and set it all up
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Don&apos;t source devices from five vendors. Get matched, pre-configured hardware shipped
            ready to run, with white-glove setup so you&apos;re live on day one.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <Printer />, title: "Receipt printers", body: "Epson LAN/Bluetooth printers, pre-paired and ready." },
            { icon: <CreditCard />, title: "Card readers", body: "EMV chip, tap & swipe readers for your gateway." },
            { icon: <ScanLine />, title: "Barcode scanners", body: "Fast 1D/2D scanning for inventory and checkout." },
            { icon: <Archive />, title: "Cash drawers", body: "Printer-triggered drawers with a clean cash flow." },
          ].map((h, i) => (
            <Reveal key={h.title} delay={i * 70}>
              <div className="group h-full rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white transition group-hover:bg-brand-600">
                  {h.icon}
                </div>
                <div className="text-lg font-semibold text-slate-900">{h.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{h.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* setup callout */}
        <Reveal delay={120}>
          <div className="mt-8 flex flex-col items-center justify-between gap-6 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 md:flex-row">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white">
                <Wrench />
              </span>
              <div>
                <div className="text-lg font-semibold text-slate-900">Done-for-you setup &amp; onboarding</div>
                <p className="mt-1 max-w-xl text-sm text-slate-600">
                  Our team configures your devices, loads your menu, connects your printer and reader,
                  and trains your staff — so opening day just works.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
              <Truck size={16} /> Shipped ready-to-run
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───────── STATS ───────── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <Reveal className="relative overflow-hidden rounded-3xl bg-slate-950 px-8 py-14">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-600/20 blur-3xl" />
          <div className="relative grid gap-y-10 text-center md:grid-cols-4 md:divide-x md:divide-white/10">
            <Stat value={<><CountUp to={4} />-in-1</>} label="POS · Kiosk · KDS · Admin" />
            <Stat value={<CountUp to={5} prefix="< " suffix=" min" />} label="To set up your store" />
            <Stat value="Multi-location" label="One account, every store" />
            <Stat value={<CountUp to={3} suffix=" platforms" />} label="iOS · Android · Web" />
          </div>
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
          <h2 className="animate-gradient bg-gradient-to-r from-white via-brand-100 to-white bg-[length:200%_auto] bg-clip-text text-4xl font-bold tracking-tight text-transparent">
            Ready to run smarter?
          </h2>
          <p className="mt-4 text-lg text-brand-50">
            Start free in minutes. Add a kiosk, a kitchen screen, and more locations as you grow.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={APP_SIGNUP_URL} className="group relative inline-flex overflow-hidden rounded-md">
              <Button size="lg" className="relative bg-white text-brand-700 hover:bg-brand-50">
                Start free
              </Button>
              {/* shimmer sweep on hover */}
              <span className="animate-shimmer pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_35%,rgba(255,255,255,0.7)_50%,transparent_65%)] bg-[length:200%_100%] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
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
    <div className="group relative rounded-2xl border border-slate-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-lg">
      {/* gradient accent ring revealed on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-400 via-brand-500 to-brand-300 opacity-0 transition-opacity duration-300 [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [mask-composite:exclude] [padding:1px] group-hover:opacity-100" />
      <div className="relative">
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white group-hover:shadow-md group-hover:shadow-brand-600/30">
          {icon}
        </div>
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
      </div>
    </div>
  );
}

function Highlight({
  eyebrow,
  title,
  body,
  points,
  align,
  visual,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  align: "left" | "right";
  visual: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-12 md:grid-cols-2">
      <div className={align === "right" ? "md:order-2" : ""}>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</div>
        <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{title}</h3>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">{body}</p>
        <ul className="mt-7 space-y-3.5">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-3 text-slate-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <Check size={13} />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={align === "right" ? "md:order-1" : ""}>{visual}</div>
    </div>
  );
}

/** A polished device frame wrapper for the highlight mockups. */
function Frame({
  title,
  children,
  float = false,
  tilt = "left",
}: {
  title: string;
  children: React.ReactNode;
  /** Apply a gentle continuous floating motion. */
  float?: boolean;
  /** Direction the frame tilts toward on hover. */
  tilt?: "left" | "right";
}) {
  return (
    <div className={float ? "animate-floaty" : undefined}>
      <div
        className={`group rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-100 to-white p-2.5 shadow-xl shadow-slate-900/[0.06] transition-transform duration-500 ease-out will-change-transform hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-brand-900/10 ${
          tilt === "right"
            ? "hover:[transform:perspective(1100px)_rotateY(-4deg)_rotateX(2deg)_translateY(-6px)]"
            : "hover:[transform:perspective(1100px)_rotateY(4deg)_rotateX(2deg)_translateY(-6px)]"
        }`}
      >
        <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white">
          <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-3.5 py-2">
            <span className="h-2 w-2 rounded-full bg-red-300" />
            <span className="h-2 w-2 rounded-full bg-amber-300" />
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            <span className="ml-2 text-[11px] text-slate-400">{title}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function CheckoutMock() {
  return (
    <Frame title="Squarely · Checkout" float tilt="left">
      <div className="flex flex-col items-center px-6 py-8">
        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Amount due</div>
        <div className="mt-1 text-5xl font-bold tracking-tight text-slate-900">$8.70</div>

        <div className="mt-6 flex w-full max-w-[240px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex h-10 w-14 items-center justify-center rounded-md bg-gradient-to-br from-slate-800 to-slate-900">
            <div className="h-3.5 w-6 rounded-sm bg-amber-300/90" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-700">Tap, insert or swipe</div>
            <div className="text-[10px] text-slate-400">Reader connected</div>
          </div>
          <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500" />
        </div>

        <div className="mt-4 flex gap-2">
          <span className="rounded-full bg-brand-600 px-3 py-1 text-[11px] font-medium text-white">Card</span>
          <span className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-600">Cash</span>
          <span className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-600">Split</span>
        </div>

        <div className="mt-6 w-full max-w-[240px] rounded-xl bg-emerald-50 px-4 py-2.5 text-center text-[11px] font-semibold text-emerald-700">
          ✓ Approved · Receipt sent
        </div>
      </div>
    </Frame>
  );
}

function KdsMock() {
  const tickets = [
    ["#128", "Kiosk", "received", "border-amber-200 bg-amber-50", ["1× Latte", "1× Bagel"]],
    ["#129", "POS", "preparing", "border-sky-200 bg-sky-50", ["2× Espresso"]],
    ["#130", "Kiosk", "ready", "border-emerald-200 bg-emerald-50", ["1× Avocado Toast"]],
  ];
  return (
    <Frame title="Squarely · Kitchen Display" tilt="right">
      <div className="grid grid-cols-3 gap-2.5 p-4">
        {tickets.map(([num, src, status, cls, lines]) => (
          <div key={num as string} className={`rounded-lg border p-2.5 ${cls}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800">{num}</span>
              <span className="text-[9px] uppercase text-slate-400">{src}</span>
            </div>
            <div className="mt-2 space-y-1">
              {(lines as string[]).map((l) => (
                <div key={l} className="text-[10px] text-slate-600">{l}</div>
              ))}
            </div>
            <div className="mt-2.5 rounded bg-slate-900 py-1 text-center text-[9px] font-semibold capitalize text-white">
              {status}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="px-4">
      <div className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
        {value}
      </div>
      <div className="mt-2 text-sm text-slate-400">{label}</div>
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
