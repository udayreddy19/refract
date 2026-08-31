"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { adminApi, downloadCsv, type AdminPayment } from "@/lib/admin-api";

export default function AdminPaymentsPage() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [canReview, setCanReview] = useState(false);

  const load = async (filter = status, query = q) => {
    setError("");
    try {
      const res = await adminApi.payments(filter, query);
      setPayments(res.payments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        try {
          const me = await adminApi.me();
          if (!cancelled) {
            setCanReview(!!me.permissions?.canReviewPayments);
            await load("", "");
          }
        } catch {
          // AdminShell redirects
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const review = async (id: string, action: "approve" | "reject" | "refund") => {
    setBusyId(id);
    try {
      await adminApi.reviewPayment({ id, action, note: notes[id] || "" });
      await load(status, q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed.");
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = () => {
    downloadCsv("reconcilex_payments.csv", [
      ["id", "email", "name", "plan", "amount", "utr", "status", "createdAt", "note"],
      ...payments.map((p) => [
        p.id,
        p.email,
        p.name || "",
        p.plan,
        String(p.amount),
        p.utr,
        p.status,
        p.createdAt,
        p.note || "",
      ]),
    ]);
  };

  return (
    <AdminShell title="Payments">
      <div className="admin-toolbar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email, UTR, note…"
          onKeyDown={(e) => {
            if (e.key === "Enter") void load(status, q);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            const next = e.target.value;
            setStatus(next);
            void load(next, q);
          }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button type="button" className="admin-btn primary" onClick={() => void load(status, q)}>
          Search
        </button>
        <button type="button" className="admin-btn" onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      {error && <div className="admin-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>UTR inbox</h2>
        </div>
        {payments.length === 0 ? (
          <div className="admin-empty">No payments in this filter.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Plan</th>
                  <th>UTR</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name || p.email}</strong>
                      <div style={{ fontSize: 12, color: "var(--t-dim)" }}>{p.email}</div>
                      <div style={{ fontSize: 11, color: "var(--t-dim)" }}>
                        {p.createdAt ? new Date(p.createdAt).toLocaleString() : ""}
                      </div>
                    </td>
                    <td>{p.plan}</td>
                    <td><strong>{p.utr}</strong></td>
                    <td>₹{Number(p.amount).toLocaleString("en-IN")}</td>
                    <td>
                      <span className={`admin-badge ${p.status}`}>{p.status}</span>
                      <div style={{ fontSize: 11, color: "var(--t-dim)", marginTop: 4 }}>
                        {p.method === "razorpay" ? "Razorpay" : p.method === "upi_manual" ? "UPI/UTR" : (p.method || "—")}
                      </div>
                    </td>
                    <td style={{ minWidth: 140 }}>
                      {p.status === "pending" ? (
                        <input
                          value={notes[p.id] || ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                          placeholder="Review note"
                          style={{ width: "100%" }}
                        />
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--t-dim)" }}>{p.note || "—"}</span>
                      )}
                    </td>
                    <td>
                      {p.status === "pending" ? (
                        canReview ? (
                        <div className="admin-actions">
                          <button
                            type="button"
                            className="admin-btn primary"
                            disabled={busyId === p.id}
                            onClick={() => void review(p.id, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="admin-btn danger"
                            disabled={busyId === p.id}
                            onClick={() => void review(p.id, "reject")}
                          >
                            Reject
                          </button>
                        </div>
                        ) : (
                          <span style={{ color: "var(--t-dim)", fontSize: 12 }}>View only</span>
                        )
                      ) : p.status === "approved" ? (
                        <div className="admin-actions">
                          {canReview && (
                          <button
                            type="button"
                            className="admin-btn danger"
                            disabled={busyId === p.id}
                            onClick={() => void review(p.id, "refund")}
                          >
                            Refund
                          </button>
                          )}
                          <a
                            className="admin-btn"
                            href={`/api/payments/invoice.php?id=${encodeURIComponent(p.id)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Invoice
                          </a>
                        </div>
                      ) : (
                        <span style={{ color: "var(--t-dim)", fontSize: 12 }}>
                          {p.reviewedAt ? new Date(p.reviewedAt).toLocaleString() : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
