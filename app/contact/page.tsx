import MarketingShell from "@/components/MarketingShell";

export default function ContactPage() {
  return (
    <MarketingShell
      title="Contact"
      subtitle="Questions about reconciliation, Pro activation, or partnerships — we’re here."
      returnTo="/contact"
    >
      <div className="contact-grid">
        <a className="contact-card" href="mailto:hello@reconcilex.in">
          <h2>General</h2>
          <p>Product questions, demos, and partnerships.</p>
          <strong>hello@reconcilex.in</strong>
        </a>
        <a className="contact-card" href="mailto:billing@reconcilex.in">
          <h2>Billing &amp; Pro</h2>
          <p>UTR verification status, invoices, and plan changes.</p>
          <strong>billing@reconcilex.in</strong>
        </a>
        <a className="contact-card" href="mailto:privacy@reconcilex.in">
          <h2>Privacy</h2>
          <p>Data handling and account deletion requests.</p>
          <strong>privacy@reconcilex.in</strong>
        </a>
      </div>
      <section className="legal-section" style={{ marginTop: 32 }}>
        <h2>Before you write</h2>
        <ul>
          <li>Include your Google account email if the issue is about Pro activation</li>
          <li>Attach the UTR / UPI reference for payment checks</li>
          <li>For CSV matching issues, describe the channels and what looked wrong (no need to send full ledgers)</li>
        </ul>
      </section>
    </MarketingShell>
  );
}
