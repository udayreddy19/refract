"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle, Copy, RotateCw, X } from "lucide-react";
import AuthModal from "@/components/AuthModal";
import {
  createRazorpayOrder,
  getPublicSettings,
  getUserSession,
  submitPaymentUtr,
  verifyRazorpayPayment,
  type PublicSettings,
  type UserSession,
} from "@/lib/auth";

export type PlanId = "monthly" | "quarterly" | "annual";

export const CHECKOUT_PLAN_KEY = "reconcilex_checkout_plan";

export function rememberCheckoutPlan(plan: PlanId) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CHECKOUT_PLAN_KEY, plan);
}

export function readCheckoutPlan(): PlanId | null {
  if (typeof window === "undefined") return null;
  const v = sessionStorage.getItem(CHECKOUT_PLAN_KEY);
  if (v === "monthly" || v === "quarterly" || v === "annual") return v;
  return null;
}

const FALLBACK = { monthly: 4999, quarterly: 9999, annual: 29999 };

type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckout = {
  open: () => void;
  on: (event: string, handler: (resp: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

function planLabel(plan: PlanId) {
  return plan === "monthly" ? "Monthly" : plan === "quarterly" ? "Quarterly" : "Annual";
}

function planPrice(plan: PlanId, settings: PublicSettings | null) {
  const amount = settings?.plans?.[plan]?.amount ?? FALLBACK[plan];
  const period = plan === "monthly" ? "month" : plan === "quarterly" ? "quarter" : "year";
  return `₹${amount.toLocaleString("en-IN")}/${period}`;
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Razorpay script failed")));
      if (window.Razorpay) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

function CheckoutBody({
  initialPlan,
  returnTo,
  onClose,
  onSubmitted,
}: {
  initialPlan: PlanId;
  returnTo: string;
  onClose: () => void;
  onSubmitted?: (session: UserSession | null) => void;
}) {
  const [plan, setPlan] = useState<PlanId>(initialPlan);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [user, setUser] = useState<UserSession | null>(null);
  const [utrValue, setUtrValue] = useState("");
  const [error, setError] = useState("");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [step, setStep] = useState<"pay" | "verifying" | "submitted" | "activated">("pay");
  const [showAuth, setShowAuth] = useState(false);
  const [showManualUpi, setShowManualUpi] = useState(false);
  const [paying, setPaying] = useState(false);
  const [successRef, setSuccessRef] = useState("");
  const [autoRenew, setAutoRenew] = useState(false);

  const razorpayOn = !!settings?.razorpayEnabled && !!settings?.razorpayKeyId;

  useEffect(() => {
    rememberCheckoutPlan(initialPlan);
    const timer = setTimeout(() => {
      void (async () => {
        const [session, pub] = await Promise.all([
          getUserSession().catch(() => null),
          getPublicSettings().catch(() => null),
        ]);
        setUser(session);
        if (pub) setSettings(pub);
        if (!pub?.razorpayEnabled) setShowManualUpi(true);
        void import("@/lib/auth").then(({ trackEvent }) =>
          trackEvent("checkout_open", { plan: initialPlan })
        );
      })();
    }, 0);
    return () => clearTimeout(timer);
  }, [initialPlan]);

  const finishSuccess = async (ref: string, activated: boolean) => {
    setSuccessRef(ref);
    setStep(activated ? "activated" : "submitted");
    const session = await getUserSession();
    setUser(session);
    onSubmitted?.(session);
  };

  const payWithRazorpay = async () => {
    setError("");
    if (!user) {
      rememberCheckoutPlan(plan);
      setShowAuth(true);
      setError("Sign in with Google before paying.");
      return;
    }
    setPaying(true);
    setStep("verifying");
    try {
      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error("Razorpay checkout is unavailable.");

      const order = await createRazorpayOrder(plan, autoRenew);
      const isSub = order.mode === "subscription" && !!order.subscription?.id;

      const options: Record<string, unknown> = {
        key: order.keyId,
        name: "ReconcileX",
        description: `Pro ${planLabel(plan)}${autoRenew ? " (auto-renew)" : ""}`,
        prefill: {
          name: order.prefill.name,
          email: order.prefill.email,
        },
        notes: {
          plan,
          paymentId: order.payment.id,
          autoRenew: autoRenew ? "1" : "0",
        },
        theme: { color: "#111827" },
        handler: async (response: RazorpaySuccess & { razorpay_subscription_id?: string }) => {
          try {
            setStep("verifying");
            if (isSub || response.razorpay_subscription_id) {
              await verifyRazorpayPayment({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id:
                  response.razorpay_subscription_id || order.subscription?.id || "",
                razorpay_signature: response.razorpay_signature,
              });
            } else {
              await verifyRazorpayPayment(response);
            }
            await finishSuccess(response.razorpay_payment_id, true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Payment verification failed.");
            setStep("pay");
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            setStep("pay");
          },
        },
      };

      if (isSub) {
        options.subscription_id = order.subscription!.id;
      } else if (order.order) {
        options.amount = order.order.amount;
        options.currency = order.order.currency;
        options.order_id = order.order.id;
      } else {
        throw new Error("Razorpay did not return an order or subscription.");
      }

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", (resp: unknown) => {
        const msg =
          typeof resp === "object" &&
          resp &&
          "error" in resp &&
          typeof (resp as { error?: { description?: string } }).error?.description === "string"
            ? (resp as { error: { description: string } }).error.description
            : "Payment failed.";
        setError(msg);
        setPaying(false);
        setStep("pay");
      });

      rzp.open();
      // Checkout UI takes over; keep verifying label until handler/dismiss
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Razorpay.");
      setPaying(false);
      setStep("pay");
    }
  };

  const submitUtr = async () => {
    const entered = utrValue.trim();
    if (!entered) {
      setError("Enter the UTR / reference number from your payment.");
      return;
    }
    if (!user) {
      rememberCheckoutPlan(plan);
      setShowAuth(true);
      setError("Sign in with Google before submitting a UTR.");
      return;
    }
    setError("");
    setStep("verifying");
    try {
      await submitPaymentUtr({ plan, utr: entered });
      await finishSuccess(entered, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit UTR.");
      setStep("pay");
    }
  };

  const authReturn =
    returnTo.includes("?") ? `${returnTo}&checkout=1` : `${returnTo}?checkout=1`;

  return (
    <>
      <div
        className="checkout-modal-overlay"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.45)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 1100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.25 }}
          style={{
            background: "var(--g-bg-card)",
            border: "1px solid var(--g-border)",
            borderRadius: 20,
            boxShadow: "var(--s-glass)",
            width: "100%",
            maxWidth: 460,
            padding: 24,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--t-hi)",
            }}
          >
            <X size={15} />
          </button>

          {step === "pay" ? (
            <>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: 8, color: "var(--t-hi)" }}>
                Activate ReconcileX Pro ({planLabel(plan)})
              </h3>
              <p style={{ fontSize: 13, color: "var(--t-mid)", textAlign: "center", marginBottom: 14, maxWidth: 340 }}>
                {razorpayOn
                  ? <>Pay <strong style={{ color: "var(--t-hi)" }}>{planPrice(plan, settings)}</strong> securely with Razorpay. Pro unlocks instantly after payment.</>
                  : <>Pay <strong style={{ color: "var(--t-hi)" }}>{planPrice(plan, settings)}</strong> via UPI and submit your UTR for admin verification.</>}
              </p>

              <div style={{ display: "flex", gap: 8, width: "100%", marginBottom: 14 }}>
                {(["monthly", "quarterly", "annual"] as PlanId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{
                      flex: 1,
                      borderColor: plan === id ? "var(--yellow)" : undefined,
                      background: plan === id ? "rgba(252,211,77,0.08)" : undefined,
                    }}
                    onClick={() => {
                      setPlan(id);
                      rememberCheckoutPlan(id);
                    }}
                  >
                    {planLabel(id)}
                  </button>
                ))}
              </div>

              {!user && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: "100%", marginBottom: 12 }}
                  onClick={() => {
                    rememberCheckoutPlan(plan);
                    setShowAuth(true);
                  }}
                >
                  Sign in with Google to continue
                </button>
              )}

              {razorpayOn && (
                <>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 10,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={autoRenew}
                      onChange={(e) => setAutoRenew(e.target.checked)}
                    />
                    Auto-renew with Razorpay Subscriptions
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: "100%", marginBottom: 10 }}
                    disabled={paying}
                    onClick={() => void payWithRazorpay()}
                  >
                    {paying
                      ? "Opening Razorpay…"
                      : `Pay ${planPrice(plan, settings)} with Razorpay`}
                  </button>
                </>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: "100%", marginBottom: 12 }}
                onClick={() => setShowManualUpi((v) => !v)}
              >
                {showManualUpi ? "Hide manual UPI" : "Pay via UPI QR / UTR instead"}
              </button>

              {showManualUpi && (
                <>
                  <div
                    style={{
                      width: 200,
                      height: 350,
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "#fff",
                      marginBottom: 16,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={settings?.qrPath || "/paytm_qr.jpg"}
                      alt="UPI QR"
                      style={{ width: 350, height: 200, transform: "rotate(90deg)", objectFit: "contain" }}
                    />
                  </div>

                  <div
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 10,
                      padding: "10px 14px",
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--t-mid)" }}>Account</span>
                      <span style={{ color: "var(--t-hi)", fontWeight: 700 }}>
                        {settings?.payeeName || "ReconcileX"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, alignItems: "center" }}>
                      <span style={{ color: "var(--t-mid)" }}>UPI ID</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: "var(--t-hi)", fontFamily: "monospace", fontSize: 11 }}>
                          {(settings?.upiId || "paytmqr28100505050101fi5qu5@paytm").slice(0, 18)}…
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(
                              settings?.upiId || "paytmqr28100505050101fi5qu5@paytm"
                            );
                            setCopiedUpi(true);
                            setTimeout(() => setCopiedUpi(false), 2000);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: copiedUpi ? "var(--green)" : "var(--t-mid)",
                          }}
                        >
                          {copiedUpi ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--t-mid)",
                      }}
                    >
                      UPI Ref / UTR Number
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        placeholder="Enter UTR / UPI reference"
                        value={utrValue}
                        onChange={(e) => {
                          setUtrValue(e.target.value);
                          if (error) setError("");
                        }}
                        style={{
                          flex: 1,
                          background: "rgba(255,255,255,0.04)",
                          border: `1px solid ${error ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.08)"}`,
                          borderRadius: 8,
                          padding: "10px 14px",
                          color: "var(--t-hi)",
                          fontSize: 13,
                          outline: "none",
                          fontFamily: "inherit",
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={!utrValue.trim()}
                        onClick={() => void submitUtr()}
                        style={{ padding: "0 18px", borderRadius: 8, fontSize: 13 }}
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                </>
              )}

              {error && <p style={{ fontSize: 12, color: "#ef4444", margin: "12px 0 0", textAlign: "center" }}>{error}</p>}
            </>
          ) : step === "verifying" ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                style={{ display: "inline-block", marginBottom: 20 }}
              >
                <RotateCw size={36} style={{ color: "var(--yellow)" }} />
              </motion.div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: 8, color: "var(--t-hi)" }}>
                {paying ? "Complete payment in Razorpay…" : "Confirming…"}
              </h3>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "rgba(52,211,153,0.1)",
                  border: "1px solid rgba(52,211,153,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <CheckCircle size={24} color="var(--green)" />
              </div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: 8, color: "var(--t-hi)" }}>
                {step === "activated" ? "Pro is active" : "UTR submitted"}
              </h3>
              <p style={{ fontSize: 13, color: "var(--t-mid)", marginBottom: 20 }}>
                {step === "activated" ? (
                  <>Payment <strong style={{ color: "var(--t-hi)" }}>{successRef}</strong> verified. Excel export is unlocked.</>
                ) : (
                  <>UTR <strong style={{ color: "var(--t-hi)" }}>{successRef}</strong> is pending admin review.</>
                )}
              </p>
              <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={onClose}>
                Done
              </button>
            </div>
          )}
        </motion.div>
      </div>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} returnTo={authReturn} />
    </>
  );
}

export default function CheckoutModal({
  isOpen,
  onClose,
  initialPlan = "monthly",
  returnTo = "/pricing",
  onSubmitted,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialPlan?: PlanId;
  returnTo?: string;
  onSubmitted?: (session: UserSession | null) => void;
}) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <CheckoutBody
          key={`${initialPlan}-${isOpen}`}
          initialPlan={initialPlan}
          returnTo={returnTo}
          onClose={onClose}
          onSubmitted={onSubmitted}
        />
      ) : null}
    </AnimatePresence>
  );
}
