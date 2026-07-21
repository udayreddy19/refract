"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, User, AlertCircle, Shield, Loader2 } from "lucide-react";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  type UserSession,
} from "@/lib/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserSession) => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setName("");
      setEmail("");
      setPassword("");
      setLoading(false);
    }
  }, [isOpen]);

  const handleGoogleAuth = async () => {
    setError("");
    setLoading(true);
    try {
      const userSession = await signInWithGoogle();
      onSuccess(userSession);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed.";
      // Don't show error if user simply closed the popup
      if (!message.includes("popup-closed-by-user") && !message.includes("cancelled-popup-request")) {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    if (tab === "signup" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      let userSession: UserSession;
      if (tab === "signup") {
        userSession = await signUpWithEmail(email.trim(), password.trim(), name.trim());
      } else {
        userSession = await signInWithEmail(email.trim(), password.trim());
      }
      onSuccess(userSession);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Authentication failed.";
      // Make Firebase error messages more user-friendly
      if (message.includes("auth/email-already-in-use")) {
        setError("An account with this email already exists.");
      } else if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password") || message.includes("auth/user-not-found")) {
        setError("Invalid email or password.");
      } else if (message.includes("auth/weak-password")) {
        setError("Password must be at least 6 characters.");
      } else if (message.includes("auth/invalid-email")) {
        setError("Please enter a valid email address.");
      } else if (message.includes("auth/too-many-requests")) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
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
            padding: "20px"
          }}
          onClick={onClose}
        >
          <motion.div
            className="auth-modal-card"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            style={{
              background: "var(--g-bg-card)",
              border: "1px solid var(--g-border)",
              borderRadius: "20px",
              boxShadow: "var(--s-glass)",
              width: "100%",
              maxWidth: "400px",
              padding: "32px 24px 28px",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: "20px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
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
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
            >
              <X size={15} />
            </button>

            {/* Header */}
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "rgba(251, 191, 36, 0.08)",
                border: "1px solid rgba(251, 191, 36, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px"
              }}>
                <Shield size={20} color="var(--yellow)" />
              </div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--t-hi)" }}>
                {tab === "login" ? "Welcome to Refract" : "Create your Account"}
              </h3>
              <p style={{ fontSize: "13px", color: "var(--t-mid)", marginTop: "4px" }}>
                {tab === "login" ? "Sign in to run automated reconciliations." : "Join Refract for instant ledger auditing."}
              </p>
            </div>

            {/* Switch Tabs */}
            <div style={{
              display: "flex",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              padding: "3px"
            }}>
              <button
                onClick={() => { setTab("login"); setError(""); }}
                style={{
                  flex: 1,
                  background: tab === "login" ? "rgba(255,255,255,0.08)" : "none",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 0",
                  fontSize: "13px",
                  fontWeight: tab === "login" ? 700 : 500,
                  color: tab === "login" ? "var(--t-hi)" : "var(--t-mid)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Sign In
              </button>
              <button
                onClick={() => { setTab("signup"); setError(""); }}
                style={{
                  flex: 1,
                  background: tab === "signup" ? "rgba(255,255,255,0.08)" : "none",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 0",
                  fontSize: "13px",
                  fontWeight: tab === "signup" ? 700 : 500,
                  color: tab === "signup" ? "var(--t-hi)" : "var(--t-mid)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Sign Up
              </button>
            </div>

            {/* Google OAuth Option */}
            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                padding: "10px 0",
                fontSize: "13.5px",
                fontWeight: 600,
                color: "var(--t-hi)",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
            >
              {loading ? (
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path
                    fill="#EA4335"
                    d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.57 14.99 1 12 1 7.35 1 3.37 3.65 1.4 7.56l3.86 3c.96-2.88 3.66-5.52 6.74-5.52z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.43c-.28 1.44-1.09 2.67-2.33 3.51l3.61 2.8c2.12-1.95 3.78-4.82 3.78-8.49z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.26 14.28c-.24-.72-.38-1.5-.38-2.28s.14-1.56.38-2.28L1.4 6.72C.51 8.5.01 10.45.01 12.5s.5 4 1.39 5.78l3.86-3z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.61-2.8c-1.2.81-2.73 1.3-4.35 1.3-3.08 0-5.78-2.64-6.74-5.52l-3.86 3C3.37 20.35 7.35 23 12 23z"
                  />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }}></div>
              <span style={{ fontSize: "11px", color: "var(--t-dim)", textTransform: "uppercase" }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }}></div>
            </div>

            {/* Manual Form */}
            <form onSubmit={handleManualAuth} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {error && (
                <div style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#ef4444",
                  fontSize: "12.5px"
                }}>
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              {tab === "signup" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--t-mid)", letterSpacing: "0.05em" }}>
                    Full Name
                  </label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--t-dim)", display: "flex" }}>
                      <User size={15} />
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={loading}
                      style={{
                        width: "100%",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "8px",
                        padding: "10px 12px 10px 36px",
                        fontSize: "13.5px",
                        color: "var(--t-hi)",
                        outline: "none"
                      }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--t-mid)", letterSpacing: "0.05em" }}>
                  Email Address
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--t-dim)", display: "flex" }}>
                    <Mail size={15} />
                  </span>
                  <input
                    type="email"
                    placeholder="e.g. name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "8px",
                      padding: "10px 12px 10px 36px",
                      fontSize: "13.5px",
                      color: "var(--t-hi)",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--t-mid)", letterSpacing: "0.05em" }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--t-dim)", display: "flex" }}>
                    <Lock size={15} />
                  </span>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "8px",
                      padding: "10px 12px 10px 36px",
                      fontSize: "13.5px",
                      color: "var(--t-hi)",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: "12px",
                  background: "var(--yellow)",
                  color: "#1e1b4b",
                  border: "none",
                  borderRadius: "8px",
                  padding: "11px 0",
                  fontSize: "13.5px",
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  textAlign: "center" as const,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
              >
                {loading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
                {tab === "login" ? "Sign In" : "Sign Up"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

