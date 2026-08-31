import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export default function NotFound() {
  return (
    <div className="page-root marketing-page">
      <SiteNav showToolLink />
      <main className="marketing-main not-found-main">
        <p className="hero-eyebrow" style={{ justifyContent: "center" }}>
          <span className="hero-dot" />
          404
        </p>
        <h1 className="hero-title" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
          Page not found
        </h1>
        <p className="hero-subtitle" style={{ marginBottom: 28 }}>
          That URL doesn’t exist. Head home to run a reconciliation, or check pricing.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/" className="btn btn-primary">
            Go home
          </Link>
          <Link href="/pricing" className="btn btn-secondary">
            View pricing
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
