"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Shield } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { adminApi, type DashboardData } from "@/lib/admin-api";

export default function AdminHomePage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);

  const loadDashboard = async () => {
    const dash = await adminApi.dashboard();
    setData(dash);
  };

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        try {
          await adminApi.me();
          if (cancelled) return;
          setAuthed(true);
          await loadDashboard();
        } catch {
          if (!cancelled) setAuthed(false);
        } finally {
          if (!cancelled) setChecking(false);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminApi.login(password);
      setAuthed(true);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="admin-loading">
        <Loader2 size={22} className="admin-spin" />
        <span>Loading admin…</span>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="admin-login-wrap">
        <form className="admin-login-card" onSubmit={onLogin}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div className="admin-brand-mark" style={{ width: 48, height: 48, borderRadius: 14 }}>
              <Shield size={22} />
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <h1>Admin CRM</h1>
            <p>Sign in with a role password: super, billing, or viewer.</p>
          </div>
          {error && <div className="admin-error">{error}</div>}
          <div className="admin-field">
            <label htmlFor="admin-password">Admin password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Role password from secrets.php"
              autoFocus
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p style={{ fontSize: 11.5, color: "var(--t-dim)", textAlign: "center" }}>
            <code>ADMIN_PASSWORD</code> (super) · <code>ADMIN_BILLING_PASSWORD</code> · <code>ADMIN_VIEWER_PASSWORD</code>
          </p>
        </form>
      </div>
    );
  }

  return (
    <AdminShell title="Dashboard">
      <div className="admin-stats">
        <div className="admin-stat">
          <div className="admin-stat-label">Users</div>
          <div className="admin-stat-value">{data?.stats.users ?? 0}</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-label">Pro users</div>
          <div className="admin-stat-value">{data?.stats.proUsers ?? 0}</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-label">Pending UTRs</div>
          <div className="admin-stat-value">{data?.stats.pendingPayments ?? 0}</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-label">Approved</div>
          <div className="admin-stat-value">{data?.stats.approvedPayments ?? 0}</div>
        </div>
      </div>

      <div className="admin-grid-2">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Recent users</h2>
            <Link href="/admin/users" className="admin-site-link">View all</Link>
          </div>
          {(data?.recentUsers.length ?? 0) === 0 ? (
            <div className="admin-empty">No users yet. They appear after Google sign-in.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.recentUsers.map((u) => (
                    <tr key={u.uid}>
                      <td>
                        <strong>{u.name}</strong>
                        <div style={{ fontSize: 12, color: "var(--t-dim)" }}>{u.email}</div>
                      </td>
                      <td>
                        <span className={`admin-badge ${u.isPro ? "pro" : "free"}`}>
                          {u.isPro ? "Pro" : "Free"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Recent payments</h2>
            <Link href="/admin/payments" className="admin-site-link">View all</Link>
          </div>
          {(data?.recentPayments.length ?? 0) === 0 ? (
            <div className="admin-empty">No UTR submissions yet.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>UTR</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.recentPayments.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.utr}</strong>
                        <div style={{ fontSize: 12, color: "var(--t-dim)" }}>
                          {p.email} · ₹{p.amount.toLocaleString("en-IN")}
                        </div>
                      </td>
                      <td>
                        <span className={`admin-badge ${p.status}`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
