"use client";

import { FormEvent, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { adminApi, type AdminSettings } from "@/lib/admin-api";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        try {
          await adminApi.me();
          if (cancelled) return;
          const res = await adminApi.settings();
          if (!cancelled) setSettings(res.settings);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to load settings.");
          }
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await adminApi.saveSettings({
        upiId: settings.upiId,
        qrPath: settings.qrPath,
        payeeName: settings.payeeName || "ReconcileX",
        gstin: settings.gstin || "",
        gstRate: settings.gstRate ?? 18,
        billingAddress: settings.billingAddress || "",
        plans: settings.plans,
      });
      setSettings(res.settings);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="Settings">
      {error && <div className="admin-error" style={{ marginBottom: 12 }}>{error}</div>}
      {saved && (
        <div
          className="admin-error"
          style={{ marginBottom: 12, background: "var(--green-bg)", borderColor: "var(--green-border)", color: "var(--green)" }}
        >
          Settings saved.
        </div>
      )}

      {!settings ? (
        <div className="admin-empty">Loading settings…</div>
      ) : (
        <form className="admin-panel" onSubmit={onSave} style={{ padding: 16 }}>
          <div className="admin-settings-grid">
            <div className="admin-field">
              <label>UPI ID</label>
              <input
                value={settings.upiId}
                onChange={(e) => setSettings({ ...settings, upiId: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label>Payee name</label>
              <input
                value={settings.payeeName || "ReconcileX"}
                onChange={(e) => setSettings({ ...settings, payeeName: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label>QR image path</label>
              <input
                value={settings.qrPath}
                onChange={(e) => setSettings({ ...settings, qrPath: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label>Upload QR image</label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setError("");
                  try {
                    const res = await adminApi.uploadQr(file);
                    setSettings(res.settings);
                    setSaved(true);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "QR upload failed.");
                  }
                }}
              />
            </div>
            <div className="admin-field">
              <label>GSTIN</label>
              <input
                value={settings.gstin || ""}
                onChange={(e) => setSettings({ ...settings, gstin: e.target.value })}
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
            <div className="admin-field">
              <label>GST rate (%)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={settings.gstRate ?? 18}
                onChange={(e) => setSettings({ ...settings, gstRate: Number(e.target.value) })}
              />
            </div>
            <div className="admin-field" style={{ gridColumn: "1 / -1" }}>
              <label>Billing address (invoices)</label>
              <textarea
                rows={3}
                value={settings.billingAddress || ""}
                onChange={(e) => setSettings({ ...settings, billingAddress: e.target.value })}
                style={{ width: "100%" }}
              />
            </div>
            {(["monthly", "quarterly", "annual"] as const).map((plan) => (
              <div key={plan} className="admin-field">
                <label>{plan} amount (₹)</label>
                <input
                  type="number"
                  min={1}
                  value={settings.plans[plan]?.amount ?? 0}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      plans: {
                        ...settings.plans,
                        [plan]: {
                          ...settings.plans[plan],
                          label: settings.plans[plan]?.label || plan,
                          amount: Number(e.target.value),
                        },
                      },
                    })
                  }
                />
              </div>
            ))}
            <button type="submit" className="admin-btn primary" disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </form>
      )}
    </AdminShell>
  );
}
