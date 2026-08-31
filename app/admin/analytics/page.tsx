"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { adminApi } from "@/lib/admin-api";

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [error, setError] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.analytics>> | null>(null);

  const load = async (d = days) => {
    setError("");
    try {
      const res = await adminApi.analytics(d);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(30);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const funnel = data?.analytics.funnel;
  const payments = data?.analytics.payments;

  return (
    <AdminShell title="Analytics">
      <div className="admin-toolbar">
        <select
          value={days}
          onChange={(e) => {
            const next = Number(e.target.value);
            setDays(next);
            void load(next);
          }}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <button type="button" className="admin-btn primary" onClick={() => void load(days)}>
          Refresh
        </button>
        <span style={{ fontSize: 12, color: "var(--t-dim)" }}>
          Storage: {data?.storage.sqlite ? "SQLite + JSON" : "JSON only"}
        </span>
      </div>

      {error && <div className="admin-error" style={{ marginBottom: 12 }}>{error}</div>}

      {!data ? (
        <div className="admin-empty">Loading…</div>
      ) : (
        <>
          <div className="admin-stats" style={{ marginBottom: 16 }}>
            <div className="admin-stat">
              <div className="admin-stat-label">Pricing views</div>
              <div className="admin-stat-value">{funnel?.pricing_view ?? 0}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-label">Checkout opens</div>
              <div className="admin-stat-value">{funnel?.checkout_open ?? 0}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-label">Payments started</div>
              <div className="admin-stat-value">{funnel?.payment_started ?? 0}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-label">Paid / conversion</div>
              <div className="admin-stat-value">
                {funnel?.payment_success ?? 0}
                <span style={{ fontSize: 14, marginLeft: 8, color: "var(--t-dim)" }}>
                  {(((funnel?.conversion ?? 0) * 100).toFixed(1))}%
                </span>
              </div>
            </div>
          </div>

          <div className="admin-panel" style={{ padding: 16, marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>Revenue ({days}d)</h2>
            <p>
              Approved: <strong>{payments?.approved ?? 0}</strong> · Failed:{" "}
              <strong>{payments?.failed ?? 0}</strong> · Refunded:{" "}
              <strong>{payments?.refunded ?? 0}</strong>
            </p>
            <p style={{ fontSize: 22, margin: "8px 0 0" }}>
              ₹{(payments?.revenueInr ?? 0).toLocaleString("en-IN")}
            </p>
          </div>

          <div className="admin-panel" style={{ padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>All events</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.analytics.events || {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([ev, count]) => (
                      <tr key={ev}>
                        <td>{ev}</td>
                        <td>{count}</td>
                      </tr>
                    ))}
                  {Object.keys(data.analytics.events || {}).length === 0 && (
                    <tr>
                      <td colSpan={2}>No tracked events yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
