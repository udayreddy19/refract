"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { adminApi, downloadCsv, type AdminUser } from "@/lib/admin-api";

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [canMutate, setCanMutate] = useState(false);

  const load = async (query = q) => {
    setError("");
    try {
      const res = await adminApi.users(query);
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        try {
          const me = await adminApi.me();
          if (!cancelled) {
            setCanMutate(!!me.permissions?.canMutateUsers);
            await load("");
          }
        } catch {
          // AdminShell redirects unauthenticated users
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grant = async (uid: string, plan: "monthly" | "quarterly" | "annual") => {
    setBusyUid(uid);
    try {
      await adminApi.updateUser({ uid, action: "grant_pro", plan });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant Pro.");
    } finally {
      setBusyUid(null);
    }
  };

  const revoke = async (uid: string) => {
    setBusyUid(uid);
    try {
      await adminApi.updateUser({ uid, action: "revoke_pro" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke Pro.");
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <AdminShell title="Users">
      <div className="admin-toolbar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, uid…"
          onKeyDown={(e) => {
            if (e.key === "Enter") void load(q);
          }}
        />
        <button type="button" className="admin-btn primary" onClick={() => void load(q)}>
          Search
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={() =>
            downloadCsv("reconcilex_users.csv", [
              ["uid", "name", "email", "isPro", "plan", "teamName", "lastLoginAt"],
              ...users.map((u) => [
                u.uid,
                u.name,
                u.email,
                u.isPro ? "yes" : "no",
                u.plan || "",
                u.teamName || "",
                u.lastLoginAt || "",
              ]),
            ])
          }
        >
          Export CSV
        </button>
      </div>

      {error && <div className="admin-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2>{users.length} users</h2>
        </div>
        {users.length === 0 ? (
          <div className="admin-empty">No users found.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.uid}>
                    <td>
                      <strong>{u.name}</strong>
                      <div style={{ fontSize: 12, color: "var(--t-dim)" }}>{u.email}</div>
                    </td>
                    <td>{u.plan || "—"}</td>
                    <td>
                      <span className={`admin-badge ${u.isPro ? "pro" : "free"}`}>
                        {u.isPro ? "Pro" : "Free"}
                      </span>
                    </td>
                    <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
                    <td>
                      {canMutate ? (
                        <div className="admin-actions">
                          {!u.isPro ? (
                            <>
                              <button
                                type="button"
                                className="admin-btn primary"
                                disabled={busyUid === u.uid}
                                onClick={() => void grant(u.uid, "monthly")}
                              >
                                Grant monthly
                              </button>
                              <button
                                type="button"
                                className="admin-btn"
                                disabled={busyUid === u.uid}
                                onClick={() => void grant(u.uid, "quarterly")}
                              >
                                Grant quarterly
                              </button>
                              <button
                                type="button"
                                className="admin-btn"
                                disabled={busyUid === u.uid}
                                onClick={() => void grant(u.uid, "annual")}
                              >
                                Grant annual
                              </button>
                              <button
                                type="button"
                                className="admin-btn"
                                disabled={busyUid === u.uid}
                                onClick={async () => {
                                  setBusyUid(u.uid);
                                  try {
                                    await adminApi.updateUser({
                                      uid: u.uid,
                                      action: "grant_trial",
                                      days: 7,
                                    });
                                    await load();
                                  } catch (err) {
                                    setError(err instanceof Error ? err.message : "Trial failed.");
                                  } finally {
                                    setBusyUid(null);
                                  }
                                }}
                              >
                                7d trial
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="admin-btn danger"
                              disabled={busyUid === u.uid}
                              onClick={() => void revoke(u.uid)}
                            >
                              Revoke Pro
                            </button>
                          )}
                          <button
                            type="button"
                            className="admin-btn"
                            disabled={busyUid === u.uid}
                            onClick={async () => {
                              setBusyUid(u.uid);
                              try {
                                await adminApi.updateUser({
                                  uid: u.uid,
                                  action: u.status === "disabled" ? "enable" : "disable",
                                });
                                await load();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Status update failed.");
                              } finally {
                                setBusyUid(null);
                              }
                            }}
                          >
                            {u.status === "disabled" ? "Enable" : "Disable"}
                          </button>
                          <button
                            type="button"
                            className="admin-btn"
                            disabled={busyUid === u.uid}
                            onClick={async () => {
                              const teamName = window.prompt("Team / brand label", u.teamName || "") ?? "";
                              const teamId =
                                window.prompt(
                                  "Team ID (shared across seats)",
                                  u.teamId || teamName.toLowerCase().replace(/\s+/g, "-")
                                ) ?? "";
                              setBusyUid(u.uid);
                              try {
                                await adminApi.updateUser({
                                  uid: u.uid,
                                  action: "set_team",
                                  teamName,
                                  teamId,
                                });
                                await load();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Failed to set team.");
                              } finally {
                                setBusyUid(null);
                              }
                            }}
                          >
                            Set team
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--t-dim)" }}>View only</span>
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
