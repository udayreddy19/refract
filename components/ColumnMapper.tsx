"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export default function ColumnMapper({
  sourceLabel,
  csvHeaders,
  expected,
  initialMap,
  onCancel,
  onApply,
}: {
  sourceLabel: string;
  csvHeaders: string[];
  expected: string[];
  initialMap: Record<string, string>;
  onCancel: () => void;
  onApply: (map: Record<string, string>) => void;
}) {
  const [map, setMap] = useState<Record<string, string>>(initialMap);
  const options = useMemo(() => ["", ...csvHeaders], [csvHeaders]);

  return (
    <div
      className="auth-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(10px)",
        zIndex: 1200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="admin-panel"
        style={{ width: "100%", maxWidth: 520, padding: 20, position: "relative" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "rgba(255,255,255,0.06)",
            border: "none",
            borderRadius: "50%",
            width: 28,
            height: 28,
            color: "var(--t-hi)",
            cursor: "pointer",
          }}
        >
          <X size={14} />
        </button>
        <h3 style={{ margin: "0 0 6px", color: "var(--t-hi)" }}>Map columns — {sourceLabel}</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--t-mid)" }}>
          We couldn’t auto-detect enough headers. Map your CSV columns once; we’ll remember this for next time.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflow: "auto" }}>
          {expected.map((field) => (
            <label key={field} className="admin-field" style={{ margin: 0 }}>
              <span style={{ textTransform: "none" }}>{field}</span>
              <select
                value={map[field] || ""}
                onChange={(e) => setMap((m) => ({ ...m, [field]: e.target.value }))}
              >
                {options.map((opt) => (
                  <option key={opt || "_"} value={opt}>
                    {opt || "— skip —"}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => onApply(map)}
          >
            Apply mapping
          </button>
        </div>
      </motion.div>
    </div>
  );
}
