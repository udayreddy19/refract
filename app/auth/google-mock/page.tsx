"use client";

import { useState } from "react";

export default function GoogleMockPage() {
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");

  const handleSelectAccount = (name: string, email: string) => {
    if (window.opener) {
      const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      window.opener.postMessage(
        {
          type: "AUTH_SUCCESS",
          user: { name, email, avatar: initials },
        },
        "*"
      );
      window.close();
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f0f4f9",
      fontFamily: "Roboto, Arial, sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px"
    }}>
      <div style={{
        background: "#ffffff",
        border: "1px solid #dadce0",
        borderRadius: "8px",
        width: "100%",
        maxWidth: "400px",
        padding: "40px 36px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
      }}>
        {/* Google Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <svg viewBox="0 0 24 24" width="24" height="24" style={{ display: "block" }}>
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
        </div>

        <h1 style={{
          fontSize: "24px",
          fontWeight: 400,
          color: "#202124",
          textAlign: "center",
          margin: "0 0 8px 0"
        }}>
          Sign in with Google
        </h1>
        <p style={{
          fontSize: "14px",
          color: "#5f6368",
          textAlign: "center",
          margin: "0 0 28px 0"
        }}>
          Choose an account to continue to <strong style={{ color: "#202124" }}>Refract</strong>
        </p>

        {!customMode ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "#dadce0", borderRadius: "4px", overflow: "hidden" }}>
            {/* Account Option 1 */}
            <button
              onClick={() => handleSelectAccount("Thalamati Udaykumar", "uday@refract.dev")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                width: "100%",
                padding: "16px",
                background: "#ffffff",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f7f8f9"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
            >
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#f43f5e",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                fontSize: "13px"
              }}>
                TU
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 500, color: "#3c4043" }}>Thalamati Udaykumar</div>
                <div style={{ fontSize: "12px", color: "#5f6368" }}>uday@refract.dev</div>
              </div>
            </button>

            {/* Use another account */}
            <button
              onClick={() => setCustomMode(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                width: "100%",
                padding: "16px",
                background: "#ffffff",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f7f8f9"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
            >
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "#f1f3f4",
                color: "#5f6368",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
              </div>
              <span style={{ fontSize: "14px", fontWeight: 500, color: "#1a73e8" }}>Use another account</span>
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#5f6368" }}>Full Name</label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                style={{
                  border: "1px solid #dadce0",
                  borderRadius: "4px",
                  padding: "10px 12px",
                  fontSize: "14px",
                  outline: "none"
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: 500, color: "#5f6368" }}>Email Address</label>
              <input
                type="email"
                placeholder="e.g. john@gmail.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                style={{
                  border: "1px solid #dadce0",
                  borderRadius: "4px",
                  padding: "10px 12px",
                  fontSize: "14px",
                  outline: "none"
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button
                onClick={() => setCustomMode(false)}
                style={{
                  flex: 1,
                  background: "none",
                  border: "1px solid #dadce0",
                  borderRadius: "4px",
                  padding: "10px 0",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#5f6368",
                  cursor: "pointer"
                }}
              >
                Back
              </button>
              <button
                onClick={() => handleSelectAccount(customName || "Google Guest", customEmail || "guest@gmail.com")}
                style={{
                  flex: 1,
                  background: "#1a73e8",
                  border: "none",
                  borderRadius: "4px",
                  padding: "10px 0",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#ffffff",
                  cursor: "pointer"
                }}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        <footer style={{
          marginTop: "32px",
          fontSize: "12px",
          color: "#5f6368",
          textAlign: "center",
          lineHeight: 1.4
        }}>
          To continue, Google will share your name, email address, and profile picture with Refract.
        </footer>
      </div>
    </div>
  );
}
