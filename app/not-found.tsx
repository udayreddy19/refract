import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative z-[1] flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-[var(--t-mid)]">404</p>
      <h1 className="font-display mt-2 text-2xl font-semibold text-[var(--t-hi)]">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-[var(--t-mid)]">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#0a0b10] shadow-[var(--s-btn-w)] hover:scale-[1.02]"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
