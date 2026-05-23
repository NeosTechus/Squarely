import type { ReactNode } from "react";
import {
  ShoppingBag,
  Smartphone,
  Tv2,
  Boxes,
  Users,
  CreditCard,
  Printer,
  Archive,
  ScanLine,
  Building2,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";

const features: { title: string; body: string; icon: ReactNode }[] = [
  { title: "POS register", body: "Cart, modifiers, split tender, tipping, discounts, receipts.", icon: <ShoppingBag /> },
  { title: "Self-order kiosk", body: "Locked-down customer-facing mode with auto-reset on idle.", icon: <Smartphone /> },
  { title: "Kitchen Display", body: "Real-time orders, status changes, prep timer, audio alerts.", icon: <Tv2 /> },
  { title: "Inventory & catalog", body: "Categories, items, variants, modifier groups, stock tracking, barcodes.", icon: <Boxes /> },
  { title: "Customers & loyalty", body: "Customer directory with order history and points balances.", icon: <Users /> },
  { title: "Payments", body: "Plug-in card readers — Valor, Stripe Terminal, Square Reader.", icon: <CreditCard /> },
  { title: "Receipt printing", body: "Epson ePOS LAN printing with cloud fallback.", icon: <Printer /> },
  { title: "Cash drawer", body: "Pulse-fired through the printer when a sale closes.", icon: <Archive /> },
  { title: "Barcode scanning", body: "Camera or Bluetooth scanners for fast item lookup.", icon: <ScanLine /> },
  { title: "Multi-location", body: "One merchant account, many storefronts. Pro and above.", icon: <Building2 /> },
  { title: "Reports", body: "Sales by category, hour, employee, payment method. CSV export.", icon: <BarChart3 /> },
  { title: "Multi-tenant SaaS", body: "Row-level security per merchant. Built for scale from day one.", icon: <ShieldCheck /> },
];

export default function Features() {
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
              One platform, every tool
            </span>
            <h1 className="mx-auto mt-7 max-w-2xl text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl">
              Everything you need to{" "}
              <span className="animate-gradient bg-gradient-to-r from-brand-300 via-brand-400 to-brand-200 bg-[length:200%_auto] bg-clip-text text-transparent">
                run your business
              </span>
              .
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-slate-300">
              Built for restaurants, retail, and growing businesses.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ───────── FEATURE GRID ───────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <div className="group h-full rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                  {f.icon}
                </div>
                <div className="text-lg font-semibold text-slate-900">{f.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
