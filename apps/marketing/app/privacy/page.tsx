import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Privacy Policy — Squarely" };

export default function Privacy() {
  return (
    <main className="min-h-screen">
      <SiteNav />
      <article className="mx-auto max-w-3xl px-6 pb-16 pt-28">
        <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {new Date().getFullYear()}</p>

        <div className="mt-8 space-y-6 text-slate-700">
          <Section title="1. Scope & who we are">
            Squarely is a multi-tenant point-of-sale (POS), self-service kiosk, and kitchen display
            system (KDS) platform owned and operated by <strong>NeosTech LLC</strong> (&ldquo;NeosTech,&rdquo;
            &ldquo;Squarely,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). This Privacy Policy describes how we
            collect, use, disclose, and safeguard personal information when you visit our websites,
            create an account, or use our products and services (collectively, the &ldquo;Services&rdquo;).
            <ul className="list-disc space-y-1 pl-6">
              <li>
                When a business (a &ldquo;Merchant&rdquo;) uses Squarely to run its operations, that Merchant is
                generally the controller of the personal information of its own staff and customers,
                and Squarely acts as a processor or service provider on the Merchant&rsquo;s behalf. In that
                role, the Merchant&rsquo;s own privacy policy governs how that information is handled.
              </li>
              <li>
                When you interact with us directly &mdash; for example, by visiting our marketing site,
                registering for an account, or contacting support &mdash; Squarely acts as the controller
                of that information, and this policy applies directly to you.
              </li>
            </ul>
            If you have questions about how a particular Merchant uses your information, please
            contact that Merchant directly.
          </Section>

          <Section title="2. Information we collect">
            We collect information in several ways: information you provide to us, information
            generated automatically as you use the Services, and information we receive from third
            parties.
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Account &amp; contact details.</strong> Name, business name, email address, phone
                number, mailing address, login credentials, role/permissions, and billing contact
                information you provide when you register or manage an account.
              </li>
              <li>
                <strong>Merchant Data.</strong> Configuration and operational data you enter into the
                Services, including menu and catalog items, modifiers, pricing, tax settings,
                inventory, orders, tickets, receipts, tips, discounts, locations, devices, and staff
                accounts.
              </li>
              <li>
                <strong>Buyer &amp; transaction metadata.</strong> Information related to purchases made
                through a Merchant using Squarely, such as order contents, amounts, timestamps,
                tax/tip/discount details, the last four digits and brand of a payment card, an
                authorization or reference token, and, where a customer provides it, a name, email,
                phone number, or loyalty identifier for receipts or order tracking.
              </li>
              <li>
                <strong>Device &amp; usage data.</strong> Technical information automatically collected when
                you use the Services, including IP address, device and hardware identifiers, browser
                type, operating system, app version, pages or screens viewed, features used, error
                logs, diagnostics, and approximate location derived from IP address.
              </li>
              <li>
                <strong>Cookies &amp; similar technologies.</strong> Information collected through cookies,
                local storage, pixels, and similar technologies as described in Section 7.
              </li>
              <li>
                <strong>Information from third parties.</strong> Information we receive from our service
                providers and partners, such as payment processors (for example, transaction status,
                fraud signals, and the masked card metadata noted above), analytics providers, fraud-
                prevention services, and identity or authentication providers you use to sign in.
              </li>
            </ul>
            We do <strong>not</strong> collect or store full payment card numbers, full magnetic-stripe data,
            CVV/CVC security codes, or PINs. That information is handled directly by the third-party
            payment processors described in Section 6.
          </Section>

          <Section title="3. How we use information">
            We use personal information to operate, maintain, and improve the Services and to run our
            business, including to:
            <ul className="list-disc space-y-1 pl-6">
              <li>provide, configure, and maintain the Services and Merchant accounts;</li>
              <li>authenticate users and secure access to accounts and devices;</li>
              <li>process and facilitate orders, payments, refunds, tips, and receipts;</li>
              <li>provide customer support and respond to your requests;</li>
              <li>
                monitor, troubleshoot, and improve performance, reliability, and security, including
                detecting and preventing fraud, abuse, and unauthorized access;
              </li>
              <li>
                develop new features and analyze usage trends, generally using aggregated or
                de-identified data;
              </li>
              <li>
                send service and administrative communications, and &mdash; where permitted or with your
                consent &mdash; product updates and marketing communications you may opt out of at any time;
              </li>
              <li>
                comply with legal obligations, enforce our agreements, and protect our rights, our
                users, and the public.
              </li>
            </ul>
          </Section>

          <Section title="4. Legal bases for processing (GDPR)">
            If you are in the European Economic Area, the United Kingdom, or another jurisdiction
            with similar laws, we process personal information only where we have a valid legal basis
            to do so. Depending on the context, those bases include:
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Contract</strong> &mdash; processing necessary to provide the Services you or your
                organization have requested under our terms;
              </li>
              <li>
                <strong>Legitimate interests</strong> &mdash; processing necessary for our legitimate
                interests, such as securing, improving, and marketing the Services, where those
                interests are not overridden by your rights;
              </li>
              <li>
                <strong>Consent</strong> &mdash; where you have given consent, for example for certain cookies
                or marketing communications, which you may withdraw at any time;
              </li>
              <li>
                <strong>Legal obligation</strong> &mdash; processing necessary to comply with applicable law,
                such as tax, accounting, and anti-fraud requirements.
              </li>
            </ul>
          </Section>

          <Section title="5. How we share information">
            We share personal information only as described below. <strong>We do not sell your personal
            data</strong>, and we do not share it for cross-context behavioral advertising in exchange for
            money or other valuable consideration.
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Service providers &amp; subprocessors.</strong> We use trusted vendors to help us run
                the Services, including cloud hosting and edge delivery (Vercel), database and
                authentication infrastructure (Supabase), and email and communications providers.
                These providers process information only on our instructions and under contractual
                confidentiality and data-protection obligations.
              </li>
              <li>
                <strong>Payment processors.</strong> When payments are taken through the Services, payment
                details are handled by the third-party processors a Merchant connects, as described
                in Section 6.
              </li>
              <li>
                <strong>Within a Merchant&rsquo;s account.</strong> Information entered into a Merchant&rsquo;s account
                is accessible to authorized users of that account based on their assigned roles and
                permissions.
              </li>
              <li>
                <strong>Legal &amp; compliance.</strong> We may disclose information where we believe in good
                faith that it is necessary to comply with applicable law, regulation, legal process,
                or a governmental request; to enforce our terms; or to protect the rights, property,
                or safety of NeosTech, our users, or others.
              </li>
              <li>
                <strong>Business transfers.</strong> If we are involved in a merger, acquisition,
                financing, reorganization, or sale of assets, personal information may be transferred
                as part of that transaction, subject to the commitments in this policy.
              </li>
              <li>
                <strong>With your direction or consent.</strong> We may share information for other purposes
                with your consent or at your direction.
              </li>
            </ul>
          </Section>

          <Section title="6. Payment data">
            Payments made through Squarely are processed by third-party payment processors that a
            Merchant connects to its account &mdash; including Stripe, Square, Adyen, PayPal, Clover,
            Authorize.Net, and Valor. These processors are independent controllers of the card and
            payment data they handle and are responsible for it under their own privacy policies and
            terms.
            <ul className="list-disc space-y-1 pl-6">
              <li>
                Sensitive cardholder data is transmitted directly to the relevant processor. Squarely
                does <strong>not</strong> store full primary account numbers (PANs), full magnetic-stripe or
                chip data, CVV/CVC codes, or PINs.
              </li>
              <li>
                We receive and may store limited, non-sensitive transaction metadata &mdash; such as the
                last four digits and brand of a card, an authorization or reference token, the amount,
                and the status &mdash; so that Merchants can reconcile orders, issue receipts, and process
                refunds.
              </li>
              <li>
                Card payments are processed in a manner intended to align with the Payment Card
                Industry Data Security Standard (PCI-DSS). We encourage you to review the privacy
                policy of the payment processor a Merchant uses for details on its handling of your
                payment information.
              </li>
            </ul>
          </Section>

          <Section title="7. Cookies & similar technologies">
            We and our service providers use cookies, local storage, and similar technologies to keep
            you signed in, remember preferences, secure the Services, measure performance, and
            understand how the Services are used.
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Strictly necessary</strong> technologies are required for core functionality such as
                authentication, session management, and security.
              </li>
              <li>
                <strong>Functional</strong> technologies remember your settings and preferences.
              </li>
              <li>
                <strong>Analytics</strong> technologies help us understand usage so we can improve the
                Services.
              </li>
            </ul>
            You can usually control cookies through your browser or device settings, and where
            required we will request your consent for non-essential technologies. Disabling some
            cookies may affect how the Services function.
          </Section>

          <Section title="8. Data retention">
            We retain personal information for as long as your account is active and as needed to
            provide the Services. We also retain information for longer where necessary to comply with
            legal, tax, accounting, and regulatory obligations, to resolve disputes, to prevent fraud
            and abuse, and to enforce our agreements. When information is no longer needed, we delete
            it or de-identify it. Retention periods for Merchant Data and Buyer information are also
            influenced by the Merchant&rsquo;s own instructions and settings.
          </Section>

          <Section title="9. Security">
            We maintain administrative, technical, and organizational measures designed to protect
            personal information, including encryption of data in transit, access controls, role-based
            permissions, network protections, and monitoring. We restrict access to personal
            information to personnel and service providers who need it to operate the Services. No
            method of transmission or storage is completely secure, however, and we cannot guarantee
            absolute security. If you believe your account has been compromised, please contact us
            immediately.
          </Section>

          <Section title="10. International data transfers">
            We are based in the United States and use service providers that may store and process
            information in the United States and other countries. As a result, your information may be
            transferred to, and processed in, countries with data-protection laws that differ from
            those in your country. Where required, we implement appropriate safeguards for cross-border
            transfers, such as the European Commission&rsquo;s Standard Contractual Clauses and equivalent
            mechanisms, and take steps to ensure your information remains protected in line with this
            policy.
          </Section>

          <Section title="11. Your privacy rights">
            Depending on where you live, you may have rights regarding your personal information. We
            honor these rights as required by applicable law.
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>General rights.</strong> Subject to applicable law, you may request to access,
                correct, update, delete, or receive a portable copy of your personal information, and
                you may object to or request that we restrict certain processing.
              </li>
              <li>
                <strong>California (CCPA/CPRA).</strong> California residents may request to know the
                categories and specific pieces of personal information we collect, the sources and
                purposes for collection, and the categories of recipients; may request deletion and
                correction; and may exercise the right to opt out of the &ldquo;sale&rdquo; or &ldquo;sharing&rdquo; of
                personal information. As noted above, <strong>we do not sell or share personal information
                </strong> as those terms are defined under California law. We will not discriminate against
                you for exercising your rights.
              </li>
              <li>
                <strong>EU/UK (GDPR).</strong> Individuals in the EEA and the UK have the rights of access,
                rectification, erasure, restriction, data portability, and objection, the right to
                withdraw consent where processing is based on consent, and the right to lodge a
                complaint with their local supervisory authority.
              </li>
            </ul>
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:privacy@neostechus.com" className="text-brand-700 underline">
              privacy@neostechus.com
            </a>
            . We may need to verify your identity before responding. If your request concerns
            information processed on behalf of a Merchant, we will refer your request to that Merchant
            or assist them in responding. You may also authorize an agent to make a request on your
            behalf where permitted by law.
          </Section>

          <Section title="12. Children">
            The Services are business tools intended for use by businesses and their authorized
            personnel. They are not directed to children, and we do not knowingly collect personal
            information from anyone under 18 (or under 16 where that is the relevant age under
            applicable law). If you believe a child has provided us personal information, please
            contact us so we can delete it.
          </Section>

          <Section title="13. Third-party links & services">
            The Services and our websites may contain links to, or integrations with, third-party
            websites and services that we do not control, including payment processors and other
            integrations a Merchant chooses to connect. This policy does not apply to those third
            parties, and we are not responsible for their privacy practices. We encourage you to review
            the privacy policies of any third-party services you use.
          </Section>

          <Section title="14. Changes to this policy">
            We may update this Privacy Policy from time to time to reflect changes in our practices,
            technologies, legal requirements, or other factors. When we make material changes, we will
            update the &ldquo;Last updated&rdquo; date above and, where appropriate, provide additional notice.
            Your continued use of the Services after an update becomes effective constitutes acceptance
            of the revised policy.
          </Section>

          <Section title="15. Contact us">
            If you have questions, concerns, or requests regarding this Privacy Policy or our handling
            of personal information, please contact NeosTech LLC at{" "}
            <a href="mailto:privacy@neostechus.com" className="text-brand-700 underline">
              privacy@neostechus.com
            </a>
            .
          </Section>

          <div className="mt-8 rounded-lg bg-slate-100 p-4 text-sm text-slate-500">
            This Privacy Policy is a general template provided for informational purposes only and does
            not constitute legal advice. It should be reviewed and adapted by a qualified attorney to
            ensure it meets your specific circumstances and the requirements of applicable laws before
            you rely on it.
          </div>
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
      <div className="mt-2 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}
