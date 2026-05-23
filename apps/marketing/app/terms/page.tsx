import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Terms & Conditions — Squarely" };

export default function Terms() {
  return (
    <main className="min-h-screen">
      <SiteNav />
      <article className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight">Terms &amp; Conditions</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {new Date().getFullYear()}</p>

        <div className="prose prose-slate mt-8 space-y-6 text-slate-700">
          <Section title="1. Agreement">
            These Terms &amp; Conditions govern your use of Squarely, a software product owned and
            operated by <strong>NeosTechus LLC</strong> (&ldquo;NeosTech&rdquo;, &ldquo;we&rdquo;,
            &ldquo;us&rdquo;). By creating an account or using the service you agree to these terms.
          </Section>
          <Section title="2. The service">
            Squarely provides point-of-sale, kiosk, kitchen display, inventory, and related
            business-management software delivered via mobile and web applications. Features
            available to you depend on your subscription plan.
          </Section>
          <Section title="3. Accounts">
            You are responsible for maintaining the confidentiality of your login credentials and
            for all activity under your account. You must provide accurate information and are
            responsible for your staff&rsquo;s use of the service.
          </Section>
          <Section title="4. Subscriptions &amp; billing">
            Paid plans are billed in advance on a recurring basis. Fees are non-refundable except
            where required by law. We may change pricing with reasonable notice.
          </Section>
          <Section title="5. Acceptable use">
            You agree not to misuse the service, attempt to disrupt it, or use it for unlawful
            activity. We may suspend accounts that violate these terms.
          </Section>
          <Section title="6. Payments &amp; third parties">
            Card processing and certain features rely on third-party providers (e.g. payment
            gateways). Your use of those services is also subject to their terms.
          </Section>
          <Section title="7. Data">
            Your business data remains yours. Our handling of personal data is described in our
            Privacy Policy.
          </Section>
          <Section title="8. Disclaimer &amp; liability">
            The service is provided &ldquo;as is.&rdquo; To the maximum extent permitted by law,
            NeosTech is not liable for indirect or consequential damages arising from use of the
            service.
          </Section>
          <Section title="9. Changes">
            We may update these terms from time to time. Continued use after changes constitutes
            acceptance.
          </Section>
          <Section title="10. Contact">
            Questions about these terms? Contact NeosTech at{" "}
            <a href="mailto:legal@neostechus.com" className="text-brand-700 underline">
              legal@neostechus.com
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
