import Link from "next/link";

const PRODUCT = [
  { href: "/#tool", label: "Run recon" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/connections", label: "Connections" },
  { href: "/account", label: "Account" },
  { href: "/status", label: "Status" },
  { href: "/#faq", label: "FAQ" },
];

const COMPANY = [
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Link href="/" className="nav-logo">
            <div className="nav-logo-mark">RX</div>
            ReconcileX
          </Link>
          <p>
            Multi-channel payment &amp; payout reconciliation for D2C brands.
            CSV matching runs in your browser — auth and billing stay on our servers.
          </p>
        </div>

        <div className="site-footer-col">
          <h4>Product</h4>
          {PRODUCT.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="site-footer-col">
          <h4>Company</h4>
          {COMPANY.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="site-footer-bottom">
        <span>© {year} ReconcileX. All rights reserved.</span>
        <span className="text-accent">reconcilex.in</span>
      </div>
    </footer>
  );
}
