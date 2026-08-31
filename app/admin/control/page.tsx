"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { adminApi } from "@/lib/admin-api";

type Control = Awaited<ReturnType<typeof adminApi.control>>;

export default function AdminControlPage() {
  const [data, setData] = useState<Control | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [trialCode, setTrialCode] = useState("");
  const [trialDays, setTrialDays] = useState("7");
  const [clTitle, setClTitle] = useState("");
  const [clBody, setClBody] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandOwner, setBrandOwner] = useState("");

  const load = async () => {
    setError("");
    try {
      setData(await adminApi.control());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load control plane.");
    }
  };

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, []);

  const act = async (body: Record<string, unknown>) => {
    setError("");
    setMsg("");
    try {
      await adminApi.controlAction(body);
      setMsg("Saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    }
  };

  if (!data) {
    return (
      <AdminShell title="Control">
        {error ? <div className="admin-error">{error}</div> : <div className="admin-empty">Loading control plane…</div>}
      </AdminShell>
    );
  }

  const flags = data.featureFlags;
  const rules = data.matchRules;
  const ann = data.announcement;

  return (
    <AdminShell title="Control">
      {error && <div className="admin-error" style={{ marginBottom: 12 }}>{error}</div>}
      {msg && (
        <div
          className="admin-error"
          style={{ marginBottom: 12, background: "var(--green-bg)", borderColor: "var(--green-border)", color: "var(--green)" }}
        >
          {msg}
        </div>
      )}

      <div className="admin-panel" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Feature flags</h2>
        <div className="admin-settings-grid">
          {Object.keys(flags).map((key) => (
            <label key={key} className="admin-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={!!flags[key]}
                onChange={(e) =>
                  setData({
                    ...data,
                    featureFlags: { ...flags, [key]: e.target.checked },
                  })
                }
              />
              {key}
            </label>
          ))}
        </div>
        <button
          type="button"
          className="admin-btn primary"
          style={{ marginTop: 12 }}
          onClick={() => void act({ action: "save_flags", featureFlags: data.featureFlags })}
        >
          Save flags
        </button>
      </div>

      <div className="admin-panel" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Match rules</h2>
        <p style={{ fontSize: 13, color: "var(--t-dim)" }}>
          Applied to every recon via public settings. Amount tolerance is in paise (100 = ₹1).
        </p>
        <div className="admin-settings-grid">
          {(
            [
              ["settlementWindowDays", "Settlement window (days)"],
              ["amountTolerancePaise", "Amount tolerance (paise)"],
              ["feePct", "Contracted fee (0–1)"],
              ["feeAnomalyFactor", "Fee anomaly factor"],
              ["fuzzyWindowDays", "Fuzzy match window (days)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="admin-field">
              {label}
              <input
                type="number"
                step="any"
                value={rules[key]}
                onChange={(e) =>
                  setData({
                    ...data,
                    matchRules: { ...rules, [key]: Number(e.target.value) },
                  })
                }
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          className="admin-btn primary"
          style={{ marginTop: 12 }}
          onClick={() => void act({ action: "save_match_rules", matchRules: data.matchRules })}
        >
          Save match rules
        </button>
      </div>

      <div className="admin-panel" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Site announcement</h2>
        <label className="admin-field" style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={!!ann.enabled}
            onChange={(e) =>
              setData({ ...data, announcement: { ...ann, enabled: e.target.checked } })
            }
          />
          Enabled
        </label>
        <label className="admin-field">
          Level
          <select
            value={ann.level}
            onChange={(e) => setData({ ...data, announcement: { ...ann, level: e.target.value } })}
          >
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="admin-field">
          Message
          <textarea
            rows={3}
            value={ann.message}
            onChange={(e) => setData({ ...data, announcement: { ...ann, message: e.target.value } })}
            style={{ width: "100%" }}
          />
        </label>
        <button
          type="button"
          className="admin-btn primary"
          onClick={() => void act({ action: "save_announcement", announcement: data.announcement })}
        >
          Save announcement
        </button>
      </div>

      <div className="admin-panel" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Risk threshold alerts</h2>
        <p style={{ fontSize: 13, color: "var(--t-dim)" }}>
          Email / Slack when a saved (or checked) recon exceeds amount-at-risk.
          {data.aiConfigured ? " Gemini AI explains are enabled." : " Add GEMINI_API_KEY for richer AI explains."}
        </p>
        <label className="admin-field" style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={!!data.alerts?.enabled}
            onChange={(e) =>
              setData({
                ...data,
                alerts: { ...(data.alerts || { thresholdInr: 10000, email: "", slackWebhook: "" }), enabled: e.target.checked },
              })
            }
          />
          Enabled
        </label>
        <div className="admin-settings-grid">
          <label className="admin-field">
            Threshold (₹)
            <input
              type="number"
              min={0}
              value={data.alerts?.thresholdInr ?? 10000}
              onChange={(e) =>
                setData({
                  ...data,
                  alerts: {
                    ...(data.alerts || { enabled: true, email: "", slackWebhook: "" }),
                    thresholdInr: Number(e.target.value),
                  },
                })
              }
            />
          </label>
          <label className="admin-field">
            Alert email
            <input
              value={data.alerts?.email || ""}
              onChange={(e) =>
                setData({
                  ...data,
                  alerts: {
                    ...(data.alerts || { enabled: true, thresholdInr: 10000, slackWebhook: "" }),
                    email: e.target.value,
                  },
                })
              }
              placeholder="ops@company.com"
            />
          </label>
          <label className="admin-field" style={{ gridColumn: "1 / -1" }}>
            Slack webhook URL
            <input
              value={data.alerts?.slackWebhook || ""}
              onChange={(e) =>
                setData({
                  ...data,
                  alerts: {
                    ...(data.alerts || { enabled: true, thresholdInr: 10000, email: "" }),
                    slackWebhook: e.target.value,
                  },
                })
              }
              placeholder="https://hooks.slack.com/services/…"
            />
          </label>
        </div>
        <button
          type="button"
          className="admin-btn primary"
          style={{ marginTop: 8 }}
          onClick={() => void act({ action: "save_alerts", alerts: data.alerts })}
        >
          Save alerts
        </button>
      </div>

      <div className="admin-panel" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Trial codes</h2>
        <div className="admin-toolbar">
          <input value={trialCode} onChange={(e) => setTrialCode(e.target.value)} placeholder="CODE (blank = auto)" />
          <input value={trialDays} onChange={(e) => setTrialDays(e.target.value)} placeholder="Days" style={{ width: 80 }} />
          <button
            type="button"
            className="admin-btn primary"
            onClick={() =>
              void act({
                action: "create_trial_code",
                code: trialCode,
                days: Number(trialDays) || 7,
                maxUses: 100,
              })
            }
          >
            Create code
          </button>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Days</th>
                <th>Used</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.trialCodes.map((c) => (
                <tr key={c.code}>
                  <td><code>{c.code}</code></td>
                  <td>{c.days}</td>
                  <td>{c.used}/{c.maxUses}</td>
                  <td>{c.active ? "yes" : "no"}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() =>
                        void act({ action: "toggle_trial_code", code: c.code, active: !c.active })
                      }
                    >
                      {c.active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-panel" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Changelog</h2>
        <div className="admin-settings-grid">
          <label className="admin-field">
            Title
            <input value={clTitle} onChange={(e) => setClTitle(e.target.value)} />
          </label>
          <label className="admin-field" style={{ gridColumn: "1 / -1" }}>
            Body
            <textarea rows={3} value={clBody} onChange={(e) => setClBody(e.target.value)} style={{ width: "100%" }} />
          </label>
        </div>
        <button
          type="button"
          className="admin-btn primary"
          style={{ marginTop: 8 }}
          onClick={() => void act({ action: "add_changelog", title: clTitle, body: clBody, published: true })}
        >
          Publish entry
        </button>
        <ul style={{ marginTop: 12, fontSize: 14 }}>
          {data.changelog.map((e) => (
            <li key={e.id} style={{ marginBottom: 8 }}>
              <strong>{e.title}</strong>{" "}
              <span style={{ color: "var(--t-dim)" }}>{e.at ? new Date(e.at).toLocaleDateString() : ""}</span>
              <button
                type="button"
                className="admin-btn danger"
                style={{ marginLeft: 8 }}
                onClick={() => void act({ action: "delete_changelog", id: e.id })}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="admin-panel" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Agency brands</h2>
        <div className="admin-toolbar">
          <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Brand name" />
          <input value={brandOwner} onChange={(e) => setBrandOwner(e.target.value)} placeholder="Owner uid" />
          <button
            type="button"
            className="admin-btn primary"
            onClick={() => void act({ action: "create_brand", name: brandName, ownerUid: brandOwner })}
          >
            Create brand
          </button>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Owner</th>
                <th>Id</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.brands.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{b.ownerUid}</td>
                  <td><code>{b.id}</code></td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn danger"
                      onClick={() => void act({ action: "delete_brand", id: b.id })}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
