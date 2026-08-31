"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MarketingShell from "@/components/MarketingShell";
import {
  getUserSession,
  updateAccountPreferences,
  fetchShopifyOrders,
  fetchRazorpayPayments,
  type UserSession,
} from "@/lib/auth";

const PROVIDERS = [
  { id: "shopify", name: "Shopify", mode: "Live Admin API + CSV" },
  { id: "razorpay", name: "Razorpay", mode: "Live payments API + CSV" },
  { id: "amazon", name: "Amazon", mode: "CSV settlements" },
  { id: "shiprocket", name: "Shiprocket", mode: "CSV remittances" },
  { id: "stripe", name: "Stripe", mode: "CSV exports" },
  { id: "woocommerce", name: "WooCommerce", mode: "CSV export" },
];

function downloadRowsCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const lines = [
    keys.join(","),
    ...rows.map((row) =>
      keys
        .map((k) => {
          const v = String(row[k] ?? "");
          if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
          return v;
        })
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ConnectionsPage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [shop, setShop] = useState("");
  const [shopToken, setShopToken] = useState("");
  const [fetching, setFetching] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      void getUserSession().then((session) => {
        setUser(session);
        const map: Record<string, string> = {};
        (session?.connections || []).forEach((c) => {
          map[c.provider] = c.notes || "";
        });
        setNotes(map);
      });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const save = async () => {
    if (!user) {
      setMsg("Sign in to save connection notes.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const connections = PROVIDERS.map((p) => ({
        provider: p.id,
        label: p.name,
        status: (p.id === "shopify" || p.id === "razorpay" ? "live" : "csv") as "live" | "csv",
        notes: notes[p.id] || "",
      }));
      const next = await updateAccountPreferences({ connections });
      setUser(next);
      setMsg("Connections saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MarketingShell
      title="Connections"
      subtitle="Pull Shopify orders or Razorpay payments as CSV, then run recon in the browser."
      returnTo="/connections"
    >
      {!user && (
        <p style={{ marginBottom: 16 }}>
          <Link href="/">Sign in</Link> to save connections and use live fetch.
        </p>
      )}
      {msg && <p style={{ marginBottom: 12, color: "var(--t-hi)" }}>{msg}</p>}

      <div className="feature-card" style={{ marginBottom: 20 }}>
        <h3>Shopify live fetch</h3>
        <p>Uses a custom app Admin API access token. Data is fetched server-side and returned as CSV rows.</p>
        <div className="admin-settings-grid" style={{ marginTop: 12 }}>
          <label className="admin-field">
            Shop domain
            <input
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              placeholder="mystore.myshopify.com"
            />
          </label>
          <label className="admin-field">
            Access token
            <input
              type="password"
              value={shopToken}
              onChange={(e) => setShopToken(e.target.value)}
              placeholder="shpat_…"
            />
          </label>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 12 }}
          disabled={!user || fetching === "shopify"}
          onClick={async () => {
            setFetching("shopify");
            setMsg("");
            try {
              const res = await fetchShopifyOrders(shop, shopToken);
              downloadRowsCsv("shopify_orders.csv", res.rows);
              setMsg(`Fetched ${res.count} Shopify orders. CSV downloaded — upload as Orders on home.`);
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "Shopify fetch failed.");
            } finally {
              setFetching(null);
            }
          }}
        >
          {fetching === "shopify" ? "Fetching…" : "Fetch Shopify orders CSV"}
        </button>
      </div>

      <div className="feature-card" style={{ marginBottom: 20 }}>
        <h3>Razorpay payments fetch</h3>
        <p>Uses the platform Razorpay keys on the server (same as checkout). Downloads last 7 days of captured payments.</p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 12 }}
          disabled={!user || fetching === "razorpay"}
          onClick={async () => {
            setFetching("razorpay");
            setMsg("");
            try {
              const res = await fetchRazorpayPayments();
              downloadRowsCsv("razorpay_payments.csv", res.rows);
              setMsg(`Fetched ${res.count} Razorpay payments. CSV downloaded — upload as Payments on home.`);
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "Razorpay fetch failed.");
            } finally {
              setFetching(null);
            }
          }}
        >
          {fetching === "razorpay" ? "Fetching…" : "Fetch Razorpay payments CSV"}
        </button>
      </div>

      <div className="features-grid">
        {PROVIDERS.map((p) => (
          <div key={p.id} className="feature-card">
            <h3>{p.name}</h3>
            <p>{p.mode}</p>
            <label className="admin-field" style={{ marginTop: 10 }}>
              Your notes
              <input
                value={notes[p.id] || ""}
                onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                placeholder="Store URL, merchant ID, export path…"
              />
            </label>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 18 }}
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save connections"}
      </button>
    </MarketingShell>
  );
}
