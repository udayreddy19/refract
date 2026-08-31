"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export default function MarketingShell({
  title,
  subtitle,
  children,
  returnTo = "/",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  returnTo?: string;
}) {
  return (
    <div className="page-root marketing-page">
      <SiteNav returnTo={returnTo} showToolLink />
      <main className="marketing-main">
        <div className="marketing-hero">
          <Link href="/" className="marketing-back">
            ← Back to home
          </Link>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="marketing-body">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
