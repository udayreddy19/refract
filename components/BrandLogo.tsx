"use client";

import React, { useState } from "react";

type BrandKey =
  | "shopify" | "woocommerce" | "magento" | "bigcommerce"
  | "razorpay" | "stripe" | "cashfree" | "payu"
  | "phonepe" | "paytm" | "instamojo" | "ccavenue"
  | "shiprocket" | "delhivery"
  | "amazon" | "flipkart" | "meesho" | "myntra" | "nykaa";

interface BrandLogoProps {
  brand: BrandKey;
  size?: number;
  dimmed?: boolean;
}

/* ── Brand config: CDN slug, brand color, fallback letter ────────────── */
const BRANDS: Record<BrandKey, {
  slug: string | null;   // Simple Icons slug (null = no CDN logo)
  color: string;         // Brand hex color (used for CDN tint & fallback bg)
  letter: string;        // Fallback letter mark
  darkInvert?: boolean;  // If true, invert in dark mode (for dark-on-transparent logos)
}> = {
  shopify:      { slug: "shopify",      color: "#96bf48", letter: "S"  },
  woocommerce:  { slug: "woocommerce",  color: "#96588a", letter: "W"  },
  magento:      { slug: "magento",      color: "#ee672f", letter: "M"  },
  bigcommerce:  { slug: "bigcommerce",  color: "#121118", letter: "B", darkInvert: true },
  razorpay:     { slug: "razorpay",     color: "#0c2451", letter: "R", darkInvert: true },
  stripe:       { slug: "stripe",       color: "#635bff", letter: "S"  },
  cashfree:     { slug: "cashfree",     color: "#00b982", letter: "C"  },
  payu:         { slug: "payu",         color: "#00b649", letter: "P"  },
  phonepe:      { slug: "phonepe",      color: "#5f259f", letter: "Pe" },
  paytm:        { slug: "paytm",        color: "#00baf2", letter: "P"  },
  instamojo:    { slug: null,           color: "#f5c542", letter: "I"  },
  ccavenue:     { slug: null,           color: "#e22028", letter: "CC" },
  shiprocket:   { slug: null,           color: "#8a2be2", letter: "Sr" },
  delhivery:    { slug: null,           color: "#e60012", letter: "D"  },
  amazon:       { slug: "amazon",       color: "#ff9900", letter: "A"  },
  flipkart:     { slug: "flipkart",     color: "#2874f0", letter: "F"  },
  meesho:       { slug: null,           color: "#f43397", letter: "M"  },
  myntra:       { slug: null,           color: "#ff3f6c", letter: "M"  },
  nykaa:        { slug: null,           color: "#fc2779", letter: "N"  },
};

/* ── Letter mark fallback ────────────────────────────────────────────── */
function LetterMark({ brand, size, dimmed }: { brand: BrandKey; size: number; dimmed: boolean }) {
  const b = BRANDS[brand];
  const isMulti = b.letter.length > 1;
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: 5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: dimmed ? "rgba(128,128,128,0.18)" : b.color,
        color: dimmed ? "rgba(128,128,128,0.55)" : "#fff",
        fontSize: isMulti ? size * 0.36 : size * 0.48,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: isMulti ? "-0.03em" : "0",
        fontFamily: "'Inter', -apple-system, sans-serif",
        transition: "all 0.2s ease",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {b.letter}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */
export default function BrandLogo({ brand, size = 22, dimmed = false }: BrandLogoProps) {
  const b = BRANDS[brand];
  if (!b) return null;

  const [imgError, setImgError] = useState(false);

  // No CDN slug → always letter mark
  if (!b.slug || imgError) {
    return <LetterMark brand={brand} size={size} dimmed={dimmed} />;
  }

  // CDN logo URL — use brand color for active, grey for dimmed
  const logoColor = dimmed ? "9ca3af" : b.color.replace("#", "");
  const src = `https://cdn.simpleicons.org/${b.slug}/${logoColor}`;

  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "opacity 0.2s ease",
        opacity: dimmed ? 0.5 : 1,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={brand}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
        }}
        onError={() => setImgError(true)}
      />
    </div>
  );
}
