import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Mail, MessageSquare, Building2 } from "lucide-react";

export const metadata = { title: "Contact — Squarely" };

export default function Contact() {
  return (
    <main className="min-h-screen bg-white">
      <SiteNav />
      <section className="grain relative overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(51,163,255,0.18),transparent_70%)]" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 pb-20 pt-28 text-center">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-brand-300/80">Contact</p>
          <h1 className="mt-7 text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
            Talk to our team
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-slate-300">
            Questions about plans, hardware, or migrating from Square or Clover? We&apos;re here to help.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid gap-5 md:grid-cols-3">
          <Card icon={<Mail />} title="Sales & general" body="hello@squarely.com" href="mailto:hello@squarely.com" />
          <Card icon={<MessageSquare />} title="Support" body="support@squarely.com" href="mailto:support@squarely.com" />
          <Card icon={<Building2 />} title="Enterprise" body="Talk to us about multi-location & custom terms." href="mailto:sales@squarely.com" />
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

function Card({ icon, title, body, href }: { icon: React.ReactNode; title: string; body: string; href: string }) {
  return (
    <a
      href={href}
      className="group block rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg"
    >
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
        {icon}
      </div>
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
    </a>
  );
}
