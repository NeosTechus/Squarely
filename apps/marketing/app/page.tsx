import Link from "next/link";
import { Button } from "@squarely/ui-web";
import { ShoppingBag, Smartphone, Tv2, Boxes, Users, BadgeCheck } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export default function Home() {
  return (
    <main className="min-h-screen">
      <SiteNav />
      <section className="px-6 pt-20 pb-24 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            Now in beta · iOS · Android
          </p>
          <h1 className="text-5xl font-bold tracking-tight text-slate-900 md:text-6xl">
            One app to run your whole business.
          </h1>
          <p className="mt-6 text-lg text-slate-600">
            POS, Kiosk, Kitchen Display, Inventory, Customers, and Reports — together in a single
            mobile app, with hardware-ready receipt printing and card readers.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link href="/download">
              <Button size="lg">Download the app</Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline">See pricing</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">Everything in one binary</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard icon={<ShoppingBag />} title="POS" body="Cart, modifiers, split tender, tip, receipt." />
          <FeatureCard icon={<Smartphone />} title="Self-order kiosk" body="Locked-down customer mode. 6-step ordering." />
          <FeatureCard icon={<Tv2 />} title="Kitchen Display" body="Real-time orders, prep timer, audio alerts." />
          <FeatureCard icon={<Boxes />} title="Inventory" body="Items, modifiers, stock levels, barcodes." />
          <FeatureCard icon={<Users />} title="Customers + loyalty" body="Directory, order history, points." />
          <FeatureCard icon={<BadgeCheck />} title="Plan-based access" body="Lights up features as you grow." />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-6">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        {icon}
      </div>
      <div className="text-lg font-semibold">{title}</div>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
    </div>
  );
}
