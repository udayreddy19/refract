"use client";

import { useEffect, useState } from "react";
import MarketingShell from "@/components/MarketingShell";
import { getChangelog } from "@/lib/auth";

export default function ChangelogPage() {
  const [entries, setEntries] = useState<Array<{ id: string; title: string; body: string; at: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      void getChangelog()
        .then(setEntries)
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <MarketingShell title="What's new" subtitle="Product updates and improvements." returnTo="/changelog">
      {loading ? (
        <p>Loading…</p>
      ) : entries.length === 0 ? (
        <p>No published updates yet.</p>
      ) : (
        <div className="legal-section">
          {entries.map((e) => (
            <article key={e.id} style={{ marginBottom: 28 }}>
              <h2 style={{ marginBottom: 4 }}>{e.title}</h2>
              <p className="text-muted" style={{ fontSize: 13, marginBottom: 8 }}>
                {e.at ? new Date(e.at).toLocaleDateString() : ""}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{e.body}</p>
            </article>
          ))}
        </div>
      )}
    </MarketingShell>
  );
}
