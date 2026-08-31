"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MarketingShell from "@/components/MarketingShell";
import CheckoutModal, {
  readCheckoutPlan,
  rememberCheckoutPlan,
  type PlanId,
} from "@/components/CheckoutModal";
import { getPublicSettings, getUserSession, trackEvent, type PublicSettings } from "@/lib/auth";

const FALLBACK = {
  monthly: 4999,
  quarterly: 9999,
  annual: 29999,
};

export default function PricingPage() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId>("monthly");
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        const [pub, session] = await Promise.all([
          getPublicSettings().catch(() => null),
          getUserSession().catch(() => null),
        ]);
        setSettings(pub);
        setIsPro(!!session?.isPro);
        void trackEvent("pricing_view");

        const params = new URLSearchParams(window.location.search);
        const wantCheckout = params.get("checkout") === "1";
        const planParam = params.get("plan");
        const remembered = readCheckoutPlan();
        const plan: PlanId =
          planParam === "monthly" || planParam === "quarterly" || planParam === "annual"
            ? planParam
            : remembered || "monthly";
        setCheckoutPlan(plan);

        if (wantCheckout || remembered) {
          setCheckoutOpen(true);
          const url = new URL(window.location.href);
          url.searchParams.delete("checkout");
          url.searchParams.delete("signed_in");
          url.searchParams.delete("auth_error");
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
        }
      })();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const openCheckout = (plan: PlanId) => {
    rememberCheckoutPlan(plan);
    setCheckoutPlan(plan);
    setCheckoutOpen(true);
  };

  const plans = [
    {
      id: "free" as const,
      name: "Free",
      price: "₹0",
      period: "forever",
      blurb: "Run reconciliations in your browser and review exceptions on screen.",
      points: [
        "Unlimited CSV recon runs",
        "On-screen matches & exceptions",
        "Sample data to try instantly",
        "Google sign-in for saved session",
      ],
      cta: "Start free recon",
      featured: false,
    },
    {
      id: "monthly" as const,
      name: "Pro Monthly",
      price: `₹${(settings?.plans?.monthly?.amount ?? FALLBACK.monthly).toLocaleString("en-IN")}`,
      period: "/ month",
      blurb: "Full Excel exports and priority support for growing D2C teams.",
      points: [
        "Everything in Free",
        "Full multi-sheet Excel export",
        "Priority support",
        "Admin-verified UPI activation",
      ],
      cta: isPro ? "Already on Pro" : "Get Pro monthly",
      featured: true,
    },
    {
      id: "quarterly" as const,
      name: "Pro Quarterly",
      price: `₹${(settings?.plans?.quarterly?.amount ?? FALLBACK.quarterly).toLocaleString("en-IN")}`,
      period: "/ quarter",
      blurb: "Better value if you reconcile every settlement cycle.",
      points: [
        "Everything in Pro Monthly",
        "Lower effective monthly rate",
        "Ideal for seasonal brands",
      ],
      cta: isPro ? "Already on Pro" : "Choose quarterly",
      featured: false,
    },
    {
      id: "annual" as const,
      name: "Pro Annual",
      price: `₹${(settings?.plans?.annual?.amount ?? FALLBACK.annual).toLocaleString("en-IN")}`,
      period: "/ year",
      blurb: "Best rate for finance teams reconciling year-round.",
      points: [
        "Everything in Pro",
        "Best annual savings",
        "Stable pricing for the year",
      ],
      cta: isPro ? "Already on Pro" : "Choose annual",
      featured: false,
    },
  ];

  return (
    <MarketingShell
      title="Simple pricing"
      subtitle="Pick a plan here — Pro checkout opens on this page. No redirect to home."
      returnTo="/pricing"
    >
      <div className="pricing-grid">
        {plans.map((plan) => (
          <article key={plan.id} className={`pricing-card ${plan.featured ? "featured" : ""}`}>
            {plan.featured ? <div className="pricing-badge">Most popular</div> : null}
            <h2>{plan.name}</h2>
            <div className="pricing-amount">
              <strong>{plan.price}</strong>
              <span>{plan.period}</span>
            </div>
            <p>{plan.blurb}</p>
            <ul>
              {plan.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            {plan.id === "free" ? (
              <Link href="/#tool" className={`btn ${plan.featured ? "btn-primary" : "btn-secondary"}`}>
                {plan.cta}
              </Link>
            ) : (
              <button
                type="button"
                className={`btn ${plan.featured ? "btn-primary" : "btn-secondary"}`}
                disabled={isPro}
                onClick={() => openCheckout(plan.id)}
              >
                {plan.cta}
              </button>
            )}
          </article>
        ))}
      </div>
      <p className="pricing-note">
        Pay securely with Razorpay (instant Pro) or via UPI QR + UTR (admin verification). Plan prices follow admin settings.
      </p>

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        initialPlan={checkoutPlan}
        returnTo="/pricing"
        onSubmitted={(session) => {
          if (session?.paymentStatus === "pending") {
            // keep modal on submitted step
          }
          setIsPro(!!session?.isPro);
        }}
      />
    </MarketingShell>
  );
}
