import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://reconcilex.in"),
  title: "ReconcileX — E-commerce Payment & Payout Reconciliation",
  description:
    "Match every order to every payout, audit gateway fees, verify marketplace settlements, and recover revenue leaks automatically. Zero data sent to external servers.",
  keywords: [
    "ReconcileX",
    "e-commerce reconciliation",
    "razorpay reconciliation",
    "shopify settlement recon",
    "payment reconciliation",
    "D2C finance",
    "reconcilex.in",
  ],
  openGraph: {
    title: "ReconcileX — E-commerce Payment & Payout Reconciliation",
    description:
      "Match every order to every payout, audit gateway fees, and recover revenue leaks. Data stays in your browser.",
    url: "https://reconcilex.in",
    siteName: "ReconcileX",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "ReconcileX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ReconcileX",
    description: "E-commerce payment & payout reconciliation for D2C brands.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

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
        <div className="ambient-bg" aria-hidden="true">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
          <div className="orb orb-4" />
        </div>
        {children}
      </body>
    </html>
  );
}
