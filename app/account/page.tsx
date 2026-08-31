"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MarketingShell from "@/components/MarketingShell";
import {
  getUserSession,
  getMyPayments,
  getMyRuns,
  getMyTeam,
  getRunById,
  deleteRun,
  signOutUser,
  teamAction,
  redeemTrialCode,
  brandAction,
  getMyBrands,
  updateAccountPreferences,
  type UserSession,
  type SavedRun,
  type TeamInfo,
} from "@/lib/auth";
import { decodePayloadB64 } from "@/lib/workflow";

type PaymentRow = {
  id: string;
  plan: string;
  amount: number;
  utr: string;
  status: string;
  createdAt: string;
  note?: string;
};

export default function AccountPage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [members, setMembers] = useState<
    Array<{ uid: string; name: string; email: string; isOwner: boolean }>
  >([]);
  const [inviteCode, setInviteCode] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [trialCode, setTrialCode] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reminderHour, setReminderHour] = useState("9");
  const [teamName, setTeamName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const reload = async () => {
    const session = await getUserSession();
    setUser(session);
    if (!session) return;
    setReminderHour(String(session.reminderHour ?? 9));
    setTeamName(session.teamName || "");
    const [mine, myRuns, myTeam, myBrands] = await Promise.all([
      getMyPayments(),
      getMyRuns().catch(() => []),
      getMyTeam().catch(() => ({ team: null, members: [], teamPro: false })),
      getMyBrands().catch(() => ({ brands: [], activeBrandId: null, activeBrandName: "" })),
    ]);
    setPayments(mine);
    setRuns(myRuns);
    setTeam(myTeam.team);
    setMembers(myTeam.members || []);
    setBrands(myBrands.brands || []);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      (async () => {
        try {
          await reload();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to load account.");
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const savePrefs = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const next = await updateAccountPreferences({
        reminderHour: Number(reminderHour),
        teamName: teamName.trim(),
      });
      setUser(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MarketingShell
      title="Your account"
      subtitle="Plan, invoices, saved runs, reminders, and team seats."
      returnTo="/account"
    >
      {loading ? (
        <p>Loading…</p>
      ) : !user ? (
        <div className="feature-card">
          <h3>Sign in required</h3>
          <p>Sign in with Google to view your ReconcileX account.</p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 12, display: "inline-flex" }}>
            Go home to sign in
          </Link>
        </div>
      ) : (
        <>
          {error && <div className="admin-error" style={{ marginBottom: 12 }}>{error}</div>}
          {saved && (
            <div
              className="admin-error"
              style={{
                marginBottom: 12,
                background: "var(--green-bg)",
                borderColor: "var(--green-border)",
                color: "var(--green)",
              }}
            >
              Preferences saved.
            </div>
          )}

          <div className="contact-grid" style={{ marginBottom: 24 }}>
            <div className="contact-card" style={{ cursor: "default" }}>
              <h2>{user.name}</h2>
              <p>{user.email}</p>
              <strong>
                {user.isPro
                  ? `Pro · ${user.selectedPlan || "active"}${user.proViaTeam ? " (via team)" : ""}`
                  : user.paymentStatus === "pending"
                    ? "Payment under review"
                    : "Free plan"}
              </strong>
              {user.proExpiresAt && user.isPro && (
                <p style={{ fontSize: 13, marginTop: 8 }}>
                  Expires {new Date(user.proExpiresAt).toLocaleDateString()}
                  {user.autoRenew ? " · auto-renew on" : ""}
                </p>
              )}
            </div>
            <div className="contact-card" style={{ cursor: "default" }}>
              <h2>Exports</h2>
              <p>{user.isPro ? "Full Excel export unlocked." : "On-screen recon free · Excel is Pro."}</p>
              <Link href="/pricing"><strong>View pricing →</strong></Link>
            </div>
            <div className="contact-card" style={{ cursor: "default" }}>
              <h2>Connections</h2>
              <p>Fetch Shopify orders or Razorpay payments into CSV-ready rows.</p>
              <Link href="/connections"><strong>Manage connections →</strong></Link>
            </div>
          </div>

          <section className="legal-section">
            <h2>Trial code</h2>
            <div className="admin-toolbar" style={{ maxWidth: 480 }}>
              <input
                value={trialCode}
                onChange={(e) => setTrialCode(e.target.value)}
                placeholder="Enter trial code"
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    const res = await redeemTrialCode(trialCode);
                    setError("");
                    setSaved(true);
                    setTrialCode("");
                    await reload();
                    alert(res.message);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Redeem failed.");
                  }
                }}
              >
                Redeem
              </button>
            </div>
          </section>

          <section className="legal-section">
            <h2>Agency brands</h2>
            <div className="admin-toolbar" style={{ maxWidth: 520 }}>
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="New brand name"
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => {
                  try {
                    await brandAction({ action: "create", name: brandName });
                    setBrandName("");
                    await reload();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Brand create failed.");
                  }
                }}
              >
                Create brand
              </button>
            </div>
            {brands.length > 0 && (
              <ul style={{ fontSize: 14 }}>
                {brands.map((b) => (
                  <li key={b.id}>
                    {b.name}{" "}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "2px 8px", fontSize: 12 }}
                      onClick={async () => {
                        await brandAction({ action: "switch", brandId: b.id });
                        await reload();
                      }}
                    >
                      Switch
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="legal-section">
            <h2>Team</h2>
            {team ? (
              <div>
                <p>
                  <strong>{team.name}</strong> · Invite code <code>{team.inviteCode}</code>
                </p>
                <ul style={{ fontSize: 14 }}>
                  {members.map((m) => (
                    <li key={m.uid}>
                      {m.name || m.email} {m.isOwner ? "(owner)" : ""}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={async () => {
                    try {
                      await teamAction({ action: "leave" });
                      await reload();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Leave failed.");
                    }
                  }}
                >
                  Leave team
                </button>
              </div>
            ) : (
              <div className="admin-settings-grid" style={{ maxWidth: 520 }}>
                <label className="admin-field">
                  Create team
                  <input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Acme finance"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    try {
                      await teamAction({ action: "create", name: newTeamName });
                      setNewTeamName("");
                      await reload();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Create failed.");
                    }
                  }}
                >
                  Create
                </button>
                <label className="admin-field">
                  Join with invite code
                  <input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="ABC123"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={async () => {
                    try {
                      await teamAction({ action: "join", inviteCode });
                      setInviteCode("");
                      await reload();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Join failed.");
                    }
                  }}
                >
                  Join
                </button>
              </div>
            )}
            <p style={{ fontSize: 13, marginTop: 10 }}>
              Team members inherit Pro while the owner has an active Pro plan.
            </p>
          </section>

          <section className="legal-section">
            <h2>Preferences</h2>
            <div className="admin-settings-grid" style={{ maxWidth: 480 }}>
              <label className="admin-field">
                Daily reconcile reminder (IST hour)
                <select value={reminderHour} onChange={(e) => setReminderHour(e.target.value)}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                Brand label
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Acme D2C"
                />
              </label>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void savePrefs()}>
                {saving ? "Saving…" : "Save preferences"}
              </button>
            </div>
          </section>

          <section className="legal-section">
            <h2>Saved runs</h2>
            {runs.length === 0 ? (
              <p>No saved reconciliations yet. Save from the results page after a run.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Matched</th>
                      <th>Exceptions</th>
                      <th>Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.id}>
                        <td>{r.label}</td>
                        <td>{r.summary.matchedCount}</td>
                        <td>{r.summary.exceptionCount}</td>
                        <td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</td>
                        <td>
                          {r.hasPayload && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: "4px 10px", fontSize: 12, marginRight: 6 }}
                              onClick={async () => {
                                try {
                                  const full = await getRunById(r.id);
                                  const payload = decodePayloadB64(full.payloadB64 || "");
                                  if (!payload) {
                                    setError("No replay payload on this run.");
                                    return;
                                  }
                                  sessionStorage.setItem("refract_payload", JSON.stringify(payload));
                                  window.location.href = "/results";
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : "Replay failed.");
                                }
                              }}
                            >
                              Replay
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: "4px 10px", fontSize: 12 }}
                            onClick={async () => {
                              await deleteRun(r.id);
                              setRuns((prev) => prev.filter((x) => x.id !== r.id));
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="legal-section">
            <h2>Payment history</h2>
            {payments.length === 0 ? (
              <p>No payments yet.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Plan</th>
                      <th>Ref</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.createdAt ? new Date(p.createdAt).toLocaleString() : "—"}</td>
                        <td>{p.plan}</td>
                        <td>{p.utr || "—"}</td>
                        <td>₹{Number(p.amount).toLocaleString("en-IN")}</td>
                        <td>{p.status}</td>
                        <td>
                          {p.status === "approved" || p.status === "refunded" ? (
                            <a
                              href={`/api/payments/invoice.php?id=${encodeURIComponent(p.id)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              GST invoice
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              await signOutUser();
              setUser(null);
              setPayments([]);
              setRuns([]);
            }}
          >
            Sign out
          </button>
        </>
      )}
    </MarketingShell>
  );
}
