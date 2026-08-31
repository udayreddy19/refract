"use client";

import { useEffect, useState } from "react";
import MarketingShell from "@/components/MarketingShell";
import { fetchHealth } from "@/lib/auth";

type Health = {
  ok?: boolean;
  time?: string;
  checks?: Record<string, { ok: boolean; detail?: string }>;
};

export default function StatusPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchHealth()
        .then((data) => setHealth(data as Health))
        .catch((err) => setError(err instanceof Error ? err.message : "Health check failed"));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <MarketingShell
      title="System status"
      subtitle="Live health checks for ReconcileX APIs on this host."
      returnTo="/status"
    >
      {error && <div className="admin-error">{error}</div>}
      {!health && !error && <p>Checking…</p>}
      {health && (
        <>
          <div
            className="feature-card"
            style={{
              marginBottom: 16,
              borderColor: health.ok ? "var(--green-border)" : "var(--red-border)",
            }}
          >
            <h3 style={{ color: health.ok ? "var(--green)" : "var(--red)" }}>
              {health.ok ? "All critical checks passing" : "Degraded"}
            </h3>
            <p>Last check: {health.time ? new Date(health.time).toLocaleString() : "—"}</p>
          </div>
          <div className="features-grid">
            {Object.entries(health.checks || {}).map(([key, val]) => (
              <div key={key} className="feature-card">
                <h3>{key}</h3>
                <p>
                  {val.ok ? "OK" : "Issue"} · {val.detail}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </MarketingShell>
  );
}
