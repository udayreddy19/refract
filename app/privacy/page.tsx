import MarketingShell from "@/components/MarketingShell";

export default function PrivacyPage() {
  return (
    <MarketingShell
      title="Privacy Policy"
      subtitle="Last updated: 20 August 2026"
      returnTo="/privacy"
    >
      <section className="legal-section">
        <h2>1. What ReconcileX does</h2>
        <p>
          ReconcileX helps D2C and e-commerce teams match orders, payments, and settlements from CSV exports.
          Reconciliation processing for your uploaded files runs locally in your browser.
        </p>
      </section>
      <section className="legal-section">
        <h2>2. Data that stays in your browser</h2>
        <p>
          CSV contents, reconciliation results, and temporary session payloads used to show the results page
          are processed client-side and are not uploaded to our servers for matching.
        </p>
      </section>
      <section className="legal-section">
        <h2>3. Data we store on our servers</h2>
        <ul>
          <li>Google account profile basics (name, email, avatar) after you sign in</li>
          <li>Pro subscription status and plan selection</li>
          <li>UTR / UPI reference numbers you submit for payment verification</li>
          <li>Admin configuration such as UPI ID, QR path, and plan prices</li>
        </ul>
      </section>
      <section className="legal-section">
        <h2>4. Cookies &amp; sessions</h2>
        <p>
          We use a secure HTTP-only session cookie to keep you signed in and to protect admin access.
          Theme preference may be stored in local storage on your device.
        </p>
      </section>
      <section className="legal-section">
        <h2>5. Third parties</h2>
        <p>
          Google OAuth is used for authentication. We do not sell your personal data.
          Payment confirmation is verified manually by an admin using the UTR you provide.
        </p>
      </section>
      <section className="legal-section">
        <h2>6. Contact</h2>
        <p>
          Privacy questions: <a href="mailto:privacy@reconcilex.in">privacy@reconcilex.in</a> or visit the{" "}
          <a href="/contact">contact page</a>.
        </p>
      </section>
    </MarketingShell>
  );
}
