"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { adminApi, type AuditEvent } from "@/lib/admin-api";

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const res = await adminApi.audit(150);
      setEvents(res.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        try {
          await adminApi.me();
          if (!cancelled) await load();
        } catch {
          // shell redirects
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <AdminShell title="Audit log">
      <div className="admin-toolbar">
        <button type="button" className="admin-btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {error && <div className="admin-error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>{events.length} recent events</h2>
        </div>
        {events.length === 0 ? (
          <div className="admin-empty">No audit events yet.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>{e.at ? new Date(String(e.at)).toLocaleString() : "—"}</td>
                    <td><strong>{e.action}</strong></td>
                    <td style={{ fontSize: 12, color: "var(--t-dim)" }}>
                      {Object.entries(e)
                        .filter(([k]) => !["id", "action", "at", "actor"].includes(k))
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join(" · ") || "—"}
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
