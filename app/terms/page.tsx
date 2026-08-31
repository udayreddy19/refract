import MarketingShell from "@/components/MarketingShell";

export default function TermsPage() {
  return (
    <MarketingShell
      title="Terms of Service"
      subtitle="Last updated: 20 August 2026"
      returnTo="/terms"
    >
      <section className="legal-section">
        <h2>1. Acceptance</h2>
        <p>
          By using ReconcileX at reconcilex.in you agree to these terms. If you do not agree, do not use the service.
        </p>
      </section>
      <section className="legal-section">
        <h2>2. The service</h2>
        <p>
          ReconcileX provides browser-based CSV reconciliation tools and optional Pro features such as full Excel export
          after payment verification. Features may change as we improve the product.
        </p>
      </section>
      <section className="legal-section">
        <h2>3. Accounts</h2>
        <p>
          You must sign in with Google to run reconciliations and manage Pro access. You are responsible for activity
          under your account and for keeping access to your Google account secure.
        </p>
      </section>
      <section className="legal-section">
        <h2>4. Payments &amp; Pro</h2>
        <p>
          Pro plans are paid via UPI. Access is granted after an admin verifies your payment reference (UTR).
          Fees are as shown on the pricing page and checkout at the time of purchase. Refunds, if any, are handled case by case.
        </p>
      </section>
      <section className="legal-section">
        <h2>5. Acceptable use</h2>
        <ul>
          <li>Do not attempt to bypass authentication, admin controls, or payment verification</li>
          <li>Do not upload unlawful content or abuse the service</li>
          <li>Do not reverse-engineer or disrupt infrastructure</li>
        </ul>
      </section>
      <section className="legal-section">
        <h2>6. Disclaimer</h2>
        <p>
          Reconciliation output depends on the quality and format of your CSVs. ReconcileX is provided “as is”
          without warranty that results are complete for accounting, tax, or legal purposes. Always verify critical figures.
        </p>
      </section>
      <section className="legal-section">
        <h2>7. Contact</h2>
        <p>
          Questions about these terms: <a href="mailto:hello@reconcilex.in">hello@reconcilex.in</a>.
        </p>
      </section>
    </MarketingShell>
  );
}
