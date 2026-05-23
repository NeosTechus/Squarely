import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Privacy Policy — Squarely" };

export default function Privacy() {
  return (
    <main className="min-h-screen">
      <SiteNav />
      <article className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {new Date().getFullYear()}</p>

        <div className="mt-8 space-y-6 text-slate-700">
          <Section title="1. Who we are">
            Squarely is owned and operated by <strong>NeosTech LLC</strong>
            (&ldquo;NeosTech&rdquo;). This policy explains how we collect, use, and protect personal
            information.
          </Section>
          <Section title="2. Information we collect">
            Account details (name, email, phone), business information you enter (merchant, items,
            customers, orders), device and usage data, and payment-related metadata processed
            through our payment partners. We do not store full card numbers.
          </Section>
          <Section title="3. How we use it">
            To provide and improve the service, authenticate users, process transactions, provide
            support, send service and (with consent) product communications, and meet legal
            obligations.
          </Section>
          <Section title="4. Sharing">
            We share data only with service providers that help us run Squarely (e.g. hosting,
            database, payment, email providers) under appropriate agreements, or when required by
            law. We do not sell your personal data.
          </Section>
          <Section title="5. Data storage &amp; security">
            Data is stored with reputable cloud providers and protected with industry-standard
            measures including encryption in transit and access controls. No system is perfectly
            secure.
          </Section>
          <Section title="6. Your rights">
            Depending on your location you may have rights to access, correct, export, or delete
            your personal data. Contact us to exercise them.
          </Section>
          <Section title="7. Retention">
            We retain data for as long as your account is active and as needed to comply with legal
            obligations, resolve disputes, and enforce agreements.
          </Section>
          <Section title="8. Children">
            Squarely is a business tool not directed to children under 16.
          </Section>
          <Section title="9. Changes">
            We may update this policy and will post the new effective date here.
          </Section>
          <Section title="10. Contact">
            Privacy questions? Contact NeosTech at{" "}
            <a href="mailto:privacy@neostechus.com" className="text-brand-700 underline">
              privacy@neostechus.com
            </a>
            .
          </Section>

          <p className="mt-8 text-sm text-slate-500">
            This is a general template and not legal advice. Have it reviewed by a qualified
            attorney before relying on it.
          </p>
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
