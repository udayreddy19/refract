"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, User, AlertCircle, Shield, Loader2, Phone, KeyRound, CheckCircle2, Eye, EyeOff } from "lucide-react";
import {
  sendPhoneOTP,
  verifyPhoneOTP,
  sendEmailOTP,
  verifyEmailOTP,
  completeAuthWithPassword,
  type UserSession,
  type EmailOTPSession,
} from "@/lib/auth";
import type { ConfirmationResult } from "firebase/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserSession) => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [emailSession, setEmailSession] = useState<EmailOTPSession | null>(null);
  const [verifiedUid, setVerifiedUid] = useState<string | undefined>(undefined);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setMethod("phone");
      setStep(1);
      setName("");
      setEmail("");
      setPhone("");
      setOtp("");
      setPassword("");
      setShowPassword(false);
      setConfirmationResult(null);
      setEmailSession(null);
      setVerifiedUid(undefined);
      setLoading(false);
    }
  }, [isOpen]);

  // Step 1: Send OTP
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (method === "phone") {
      if (!phone.trim()) {
        setError("Please enter your mobile number with country code (e.g. +919876543210).");
        return;
      }
      setLoading(true);
      try {
        const result = await sendPhoneOTP(phone.trim(), "recaptcha-container");
        setConfirmationResult(result);
        setStep(2);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to send Phone OTP.";
        setError(message);
      } finally {
        setLoading(false);
      }
    } else {
      if (!email.trim() || !email.includes("@")) {
        setError("Please enter a valid email address.");
        return;
      }
      setLoading(true);
      try {
        const session = await sendEmailOTP(email.trim());
        setEmailSession(session);
        setStep(2);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to send Email OTP.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!otp.trim()) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      if (method === "phone") {
        if (!confirmationResult) throw new Error("Verification session expired. Please request OTP again.");
        const res = await verifyPhoneOTP(confirmationResult, otp.trim(), name.trim());
        setVerifiedUid(res.uid);
      } else {
        if (!emailSession) throw new Error("Email verification session expired. Please request OTP again.");
        await verifyEmailOTP(emailSession, otp.trim());
      }
      setStep(3);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid OTP code.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set Password & Finish Setup
  const handleCompleteWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password.trim()) {
      setError("Please enter a password.");
      return;
    }

    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const userSession = await completeAuthWithPassword({
        name: name.trim(),
        identifier: method === "phone" ? phone.trim() : email.trim(),
        password: password.trim(),
        method,
        verifiedUid,
      });

      onSuccess(userSession);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed.";
      setError(message);
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
              maxWidth: "420px",
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
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "rgba(251, 191, 36, 0.08)",
                border: "1px solid rgba(251, 191, 36, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px"
              }}>
                <Shield size={22} color="var(--yellow)" />
              </div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--t-hi)" }}>
                {step === 1 && "Account Verification"}
                {step === 2 && "Enter OTP Code"}
                {step === 3 && "Set Password"}
              </h3>
              <p style={{ fontSize: "13px", color: "var(--t-mid)", marginTop: "4px" }}>
                {step === 1 && "Select mobile or mail OTP verification to get started."}
                {step === 2 && `Enter 6-digit code sent to ${method === "phone" ? phone : email}`}
                {step === 3 && "Add a secure password to complete your account setup."}
              </p>
            </div>

            {/* Invisible Recaptcha Container for Phone Auth */}
            <div id="recaptcha-container"></div>

            {/* Progress Stepper */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", margin: "-4px 0" }}>
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  style={{
                    flex: 1,
                    height: "4px",
                    borderRadius: "2px",
                    background: s <= step ? "var(--yellow)" : "rgba(255, 255, 255, 0.08)",
                    transition: "all 0.3s ease"
                  }}
                />
              ))}
            </div>

            {/* Error Message */}
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

            {/* STEP 1: Verification Choice & Contact Info */}
            {step === 1 && (
              <form onSubmit={handleSendOTP} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Method Switcher */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--t-mid)", letterSpacing: "0.05em" }}>
                    Verification Choice
                  </label>
                  <div style={{
                    display: "flex",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "8px",
                    padding: "3px"
                  }}>
                    <button
                      type="button"
                      onClick={() => { setMethod("phone"); setError(""); }}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        background: method === "phone" ? "rgba(255,255,255,0.08)" : "none",
                        border: "none",
                        borderRadius: "6px",
                        padding: "8px 0",
                        fontSize: "12.5px",
                        fontWeight: method === "phone" ? 700 : 500,
                        color: method === "phone" ? "var(--t-hi)" : "var(--t-mid)",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      <Phone size={14} />
                      Mobile Number
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMethod("email"); setError(""); }}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        background: method === "email" ? "rgba(255,255,255,0.08)" : "none",
                        border: "none",
                        borderRadius: "6px",
                        padding: "8px 0",
                        fontSize: "12.5px",
                        fontWeight: method === "email" ? 700 : 500,
                        color: method === "email" ? "var(--t-hi)" : "var(--t-mid)",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      <Mail size={14} />
                      Mail (Email)
                    </button>
                  </div>
                </div>

                {/* Name Field */}
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
                      placeholder="e.g. Alex Morgan"
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

                {/* Mobile / Email Field */}
                {method === "phone" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--t-mid)", letterSpacing: "0.05em" }}>
                      Mobile Number (with Country Code)
                    </label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--t-dim)", display: "flex" }}>
                        <Phone size={15} />
                      </span>
                      <input
                        type="tel"
                        placeholder="e.g. +919876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
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
                ) : (
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
                        placeholder="e.g. alex@company.com"
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
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    marginTop: "8px",
                    background: "var(--yellow)",
                    color: "#1e1b4b",
                    border: "none",
                    borderRadius: "8px",
                    padding: "11px 0",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                >
                  {loading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
                  Send OTP Code
                </button>
              </form>
            )}

            {/* STEP 2: Enter & Verify OTP */}
            {step === 2 && (
              <form onSubmit={handleVerifyOTP} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{
                  background: "rgba(251, 191, 36, 0.08)",
                  border: "1px solid rgba(251, 191, 36, 0.2)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--yellow)",
                  fontSize: "12px",
                  fontWeight: 600
                }}>
                  <CheckCircle2 size={15} />
                  <span>OTP code sent to {method === "phone" ? phone : email}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--t-mid)", letterSpacing: "0.05em" }}>
                      6-Digit OTP Code
                    </label>
                  </div>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--t-dim)", display: "flex" }}>
                      <KeyRound size={15} />
                    </span>
                    <input
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      disabled={loading}
                      maxLength={6}
                      style={{
                        width: "100%",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "8px",
                        padding: "10px 12px 10px 36px",
                        fontSize: "15px",
                        letterSpacing: "0.15em",
                        fontWeight: 700,
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
                    marginTop: "8px",
                    background: "var(--yellow)",
                    color: "#1e1b4b",
                    border: "none",
                    borderRadius: "8px",
                    padding: "11px 0",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                >
                  {loading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
                  Verify OTP
                </button>

                <button
                  type="button"
                  onClick={() => { setStep(1); setOtp(""); setError(""); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--t-mid)",
                    fontSize: "12px",
                    cursor: "pointer",
                    textAlign: "center"
                  }}
                >
                  Change {method === "phone" ? "Mobile Number" : "Email Address"}
                </button>
              </form>
            )}

            {/* STEP 3: Password Integration */}
            {step === 3 && (
              <form onSubmit={handleCompleteWithPassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{
                  background: "rgba(34, 197, 94, 0.08)",
                  border: "1px solid rgba(34, 197, 94, 0.2)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#4ade80",
                  fontSize: "12px",
                  fontWeight: 600
                }}>
                  <CheckCircle2 size={15} />
                  <span>OTP Verified for {method === "phone" ? phone : email}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--t-mid)", letterSpacing: "0.05em" }}>
                    Create / Enter Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--t-dim)", display: "flex" }}>
                      <Lock size={15} />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      style={{
                        width: "100%",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "8px",
                        padding: "10px 40px 10px 36px",
                        fontSize: "13.5px",
                        color: "var(--t-hi)",
                        outline: "none"
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "var(--t-dim)",
                        cursor: "pointer",
                        display: "flex"
                      }}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    marginTop: "8px",
                    background: "var(--yellow)",
                    color: "#1e1b4b",
                    border: "none",
                    borderRadius: "8px",
                    padding: "11px 0",
                    fontSize: "13.5px",
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                >
                  {loading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
                  Set Password & Complete Setup
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
