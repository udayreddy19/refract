"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, Shield, Loader2 } from "lucide-react";
import { signInWithGoogle } from "@/lib/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Where to return after Google OAuth (e.g. / or /results) */
  returnTo?: string;
}

function formatAuthError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.1 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.8-6.5 7.3l.1.1 6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.5-.4-3.5z" />
    </svg>
  );
}

export default function AuthModal({ isOpen, onClose, returnTo = "/" }: AuthModalProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleModalClose = () => {
    setError("");
    setLoading(false);
    onClose();
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle(returnTo);
    } catch (err: unknown) {
      setLoading(false);
      setError(formatAuthError(err, "Google sign-in failed."));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="auth-modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={handleModalClose}
        >
          <motion.div
            className="auth-modal-card"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: "var(--g-bg-card)",
              border: "1px solid var(--g-border)",
              borderRadius: "20px",
              boxShadow: "var(--s-glass)",
              width: "100%",
              maxWidth: "400px",
              padding: "36px 28px 28px",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              alignItems: "stretch",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleModalClose}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "rgba(255,255,255,0.06)",
                border: "none",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--t-hi)",
              }}
              aria-label="Close"
            >
              <X size={15} />
            </button>

            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "14px",
                  background: "rgba(251, 191, 36, 0.08)",
                  border: "1px solid rgba(251, 191, 36, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <Shield size={24} color="var(--yellow)" />
              </div>
              <h3
                style={{
                  fontSize: "1.3rem",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "var(--t-hi)",
                }}
              >
                Sign in to ReconcileX
              </h3>
              <p style={{ fontSize: "13.5px", color: "var(--t-mid)", marginTop: "8px", lineHeight: 1.45 }}>
                Continue with Google to sign in or create your account.
              </p>
            </div>

            {error && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  color: "#ef4444",
                  fontSize: "12.5px",
                  lineHeight: 1.4,
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                width: "100%",
                background: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "13px 16px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#1f1f1f",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.75 : 1,
                boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
              }}
            >
              {loading ? <Loader2 size={18} /> : <GoogleGlyph />}
              {loading ? "Redirecting to Google…" : "Continue with Google"}
            </button>

            <p
              style={{
                fontSize: "11.5px",
                color: "var(--t-dim)",
                textAlign: "center",
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              By continuing you agree to our{" "}
              <a href="/terms" style={{ color: "var(--t-hi)" }}>Terms</a>
              {" "}and{" "}
              <a href="/privacy" style={{ color: "var(--t-hi)" }}>Privacy Policy</a>.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
