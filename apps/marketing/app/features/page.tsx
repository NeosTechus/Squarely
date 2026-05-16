import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

const features = [
  { title: "POS register", body: "Cart, modifiers, split tender, tipping, discounts, receipts." },
  { title: "Self-order kiosk", body: "Locked-down customer-facing mode with auto-reset on idle." },
  { title: "Kitchen Display", body: "Real-time orders, status changes, prep timer, audio alerts." },
  { title: "Inventory & catalog", body: "Categories, items, variants, modifier groups, stock tracking, barcodes." },
  { title: "Customers & loyalty", body: "Customer directory with order history and points balances." },
  { title: "Payments", body: "Plug-in card readers — Valor, Stripe Terminal, Square Reader." },
  { title: "Receipt printing", body: "Epson ePOS LAN printing with cloud fallback." },
  { title: "Cash drawer", body: "Pulse-fired through the printer when a sale closes." },
  { title: "Barcode scanning", body: "Camera or Bluetooth scanners for fast item lookup." },
  { title: "Multi-location", body: "One merchant account, many storefronts. Pro and above." },
  { title: "Reports", body: "Sales by category, hour, employee, payment method. CSV export." },
  { title: "Multi-tenant SaaS", body: "Row-level security per merchant. Built for scale from day one." },
];

export default function Features() {
  return (
    <main className="min-h-screen">
      <SiteNav />
      <section className="px-6 pt-16 pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight">Features</h1>
          <p className="mt-3 text-slate-600">Built for restaurants, retail, and growing businesses.</p>
        </div>
        <div className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 p-6">
              <div className="text-lg font-semibold">{f.title}</div>
              <p className="mt-2 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
