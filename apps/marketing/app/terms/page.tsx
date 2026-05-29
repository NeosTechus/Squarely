import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Terms of Service — Squarely" };

export default function Terms() {
  return (
    <main className="min-h-screen">
      <SiteNav />
      <article className="mx-auto max-w-3xl px-6 pb-16 pt-28">
        <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {new Date().getFullYear()}</p>

        <div className="mt-8 space-y-7 text-slate-700">
          <Section title="1. Agreement to terms">
            These Terms of Service (the &ldquo;Terms&rdquo;) are a binding agreement between you and
            your business (&ldquo;you&rdquo;, &ldquo;Merchant&rdquo;) and <strong>NeosTech LLC</strong>{" "}
            (&ldquo;NeosTech&rdquo;, &ldquo;Squarely&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
            They govern your access to and use of the Squarely point-of-sale, self-order kiosk,
            kitchen display, back-office, and related software, websites, APIs, and mobile
            applications (collectively, the &ldquo;Services&rdquo;). By creating an account, clicking
            &ldquo;I agree,&rdquo; or using the Services, you accept these Terms. If you are entering
            into these Terms on behalf of a company, you represent that you are authorized to bind
            that company.
          </Section>

          <Section title="2. Definitions">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Merchant</strong> — the business that subscribes to and operates the Services.</li>
              <li><strong>Buyer</strong> — your customer who purchases from you using the Services.</li>
              <li><strong>Merchant Data</strong> — items, menus, orders, customers, and other content you submit.</li>
              <li><strong>Payment Processor</strong> — a third-party gateway (e.g. Stripe, Square, Adyen, PayPal, Clover, Authorize.Net, Valor) you connect to process card payments.</li>
            </ul>
          </Section>

          <Section title="3. Eligibility">
            You must be at least 18 years old and capable of forming a binding contract. The
            Services are intended for commercial use by businesses, not for personal or household
            purposes.
          </Section>

          <Section title="4. The Services">
            Squarely provides software for selling, serving, and managing a business — including the
            register (POS), self-order kiosk, kitchen display (KDS), inventory, customers, reporting,
            and administration. Features available to you depend on your subscription plan and the
            modules enabled for your account. We may add, change, or remove features over time.
          </Section>

          <Section title="5. Accounts &amp; security">
            You are responsible for configuring and safeguarding your account, including login
            credentials, staff access, and devices. You are responsible for all activity that occurs
            under your account and your staff&rsquo;s use of the Services. Notify us promptly of any
            unauthorized access. You must provide accurate, complete account information and keep it
            up to date.
          </Section>

          <Section title="6. Subscriptions, fees &amp; billing">
            Paid plans are billed in advance on a recurring basis (monthly or annually) and renew
            automatically until cancelled. By subscribing you authorize recurring charges to your
            payment method. Fees are exclusive of taxes, which you are responsible for. Except where
            required by law or expressly stated, fees are non-refundable and partial periods are not
            prorated. We may change pricing or plan features with reasonable advance notice; changes
            take effect on your next billing cycle. You may cancel at any time; cancellation stops
            future renewals but does not refund the current period.
          </Section>

          <Section title="7. Free trials &amp; plans">
            We may offer a free plan or trial. We may modify or discontinue free offerings at any
            time. Some features require a paid plan.
          </Section>

          <Section title="8. Payment processing">
            Squarely is not a bank, money transmitter, or payment processor and does not hold or move
            your funds. Card payments are processed through the third-party Payment Processor you
            connect to your account using your own merchant account and credentials. Your use of a
            Payment Processor is governed by that provider&rsquo;s own terms, and settlement,
            chargebacks, disputes, fees, and refunds to Buyers are between you and that provider. You
            authorize Squarely to transmit transaction instructions to your connected Payment
            Processor on your behalf. You are solely responsible for issuing refunds to your Buyers
            and for compliance with card-network rules and PCI-DSS.
          </Section>

          <Section title="9. Merchant responsibilities">
            You are solely responsible for: the accuracy of your menus, prices, and tax settings;
            collecting and remitting all applicable sales, use, and other taxes; the goods and
            services you sell; your relationships with and obligations to your Buyers, staff, and
            suppliers; obtaining required licenses and permits; and complying with all laws
            applicable to your business. Tax rates suggested by the Services are estimates only and
            you are responsible for verifying the correct rate for each location.
          </Section>

          <Section title="10. Acceptable use">
            You agree not to: use the Services for unlawful, fraudulent, or deceptive activity; sell
            prohibited or restricted goods; infringe others&rsquo; rights; interfere with, probe, or
            disrupt the Services or their security; reverse engineer or copy the Services; resell or
            sublicense the Services without authorization; or upload malware or unlawful content. We
            may suspend or terminate accounts that violate this section.
          </Section>

          <Section title="11. License &amp; intellectual property">
            Subject to these Terms, we grant you a limited, non-exclusive, non-transferable,
            revocable license to use the Services for your internal business operations during your
            subscription. We and our licensors retain all rights, title, and interest in the
            Services, software, and trademarks. You receive no rights except those expressly granted.
          </Section>

          <Section title="12. Your data">
            As between you and us, you own your Merchant Data. You grant us a worldwide license to
            host, process, and transmit your Merchant Data solely to provide and improve the Services,
            and as described in our Privacy Policy. You are responsible for the lawfulness of the data
            you submit and for obtaining any consents required from your Buyers and staff.
          </Section>

          <Section title="13. Third-party services">
            The Services integrate with third parties (payment gateways, hosting, hardware, mapping,
            email, and similar). We are not responsible for third-party services, and your use of them
            is subject to their terms and privacy practices.
          </Section>

          <Section title="14. Term, suspension &amp; termination">
            These Terms apply while you use the Services. We may suspend or terminate access
            immediately for breach, non-payment, legal risk, or to protect the Services or others. You
            may stop using the Services at any time. Upon termination your license ends; we may delete
            your data after a reasonable retention period in line with our Privacy Policy and the law.
          </Section>

          <Section title="15. Disclaimers">
            THE SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
            WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A
            PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not warrant that the Services will be
            uninterrupted, error-free, or secure.
          </Section>

          <Section title="16. Limitation of liability">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEOSTECH WILL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE,
            DATA, OR GOODWILL. OUR TOTAL LIABILITY ARISING OUT OF OR RELATING TO THE SERVICES WILL NOT
            EXCEED THE AMOUNTS YOU PAID US IN THE 12 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM.
          </Section>

          <Section title="17. Indemnification">
            You agree to indemnify and hold harmless NeosTech and its affiliates from claims, losses,
            and expenses arising from your use of the Services, your Merchant Data, your goods and
            services, your tax or legal non-compliance, or your breach of these Terms.
          </Section>

          <Section title="18. Governing law &amp; disputes">
            These Terms are governed by the laws of the State of Delaware, USA, without regard to
            conflict-of-laws rules. The parties will attempt to resolve disputes informally first.
            Any unresolved dispute will be handled in the state or federal courts located in
            Delaware, and you consent to their jurisdiction, except where applicable law provides
            otherwise.
          </Section>

          <Section title="19. Changes to these Terms">
            We may update these Terms from time to time. We will post the updated version with a new
            &ldquo;Last updated&rdquo; date and, for material changes, provide reasonable notice.
            Continued use after changes take effect constitutes acceptance.
          </Section>

          <Section title="20. General">
            If any provision is unenforceable, the rest remains in effect. Our failure to enforce a
            provision is not a waiver. You may not assign these Terms without our consent; we may
            assign them in connection with a merger, acquisition, or sale of assets. These Terms,
            with the Privacy Policy, are the entire agreement between you and us regarding the
            Services.
          </Section>

          <Section title="21. Contact">
            NeosTech LLC —{" "}
            <a href="mailto:legal@neostechus.com" className="text-brand-700 underline">legal@neostechus.com</a>.
          </Section>

          <p className="mt-8 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            This document is a general template adapted from common industry practice and is provided
            for convenience only. It is not legal advice. Have it reviewed by a qualified attorney
            before relying on it.
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
      <div className="mt-2 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}
