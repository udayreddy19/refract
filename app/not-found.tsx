import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative z-[1] flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-4 text-center">
      <p className="text-sm font-medium text-[var(--brand)]">404</p>
      <h1 className="font-display mt-2 text-2xl font-semibold text-[var(--t-hi)]">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-[var(--t-mid)]">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--s-btn-w)] hover:bg-[var(--brand-deep)]"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
