import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Refract — Razorpay × Shopify Reconciliation",
  description:
    "Upload your Razorpay settlement and Shopify order exports. Every order matched to every settlement, every fee verified, every mismatch flagged — in minutes.",
  keywords: ["razorpay reconciliation", "shopify settlement recon", "payment reconciliation", "D2C finance"],
};

import Script from "next/script";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script id="theme-loader" strategy="beforeInteractive">
          {`
            (function() {
              try {
                var theme = localStorage.getItem('theme') || 'dark';
                document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {}
            })();
          `}
        </Script>
      </head>
      <body>
        {/* Liquid glass ambient background with floating orbs */}
        <div className="ambient-bg">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
          <div className="orb orb-4" />
        </div>
        {/* Page content */}
        <div className="page-root">{children}</div>
      </body>
    </html>
  );
}
