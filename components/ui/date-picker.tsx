"use client";

import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "@/lib/types";
import { defaultRange } from "@/lib/services";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const presets: { id: DateRange["preset"]; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "custom", label: "Custom Range" },
];

export function DatePicker({
  value,
  onChange,
  className,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const label =
    value.preset === "custom"
      ? `${format(value.from, "dd MMM yyyy")} – ${format(value.to, "dd MMM yyyy")}`
      : presets.find((p) => p.id === value.preset)?.label || "Select Date";

  return (
    <div className={cn("relative", className)}>
      <Button type="button" variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Calendar className="h-4 w-4" />
        {label}
      </Button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close date picker"
            onClick={() => setOpen(false)}
          />
          <div className="glass absolute right-0 z-50 mt-2 w-72 rounded-[16px] p-3 shadow-[var(--s-float)]">
            <div className="relative z-[1] space-y-1">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={cn(
                    "flex w-full rounded-[12px] px-3 py-2 text-left text-sm transition-colors",
                    value.preset === p.id
                      ? "bg-[var(--brand)] font-medium text-white"
                      : "text-[var(--t-mid)] hover:bg-[var(--brand-soft)] hover:text-[var(--t-hi)]"
                  )}
                  onClick={() => {
                    if (p.id === "custom") {
                      onChange({ ...value, preset: "custom" });
                    } else {
                      onChange(defaultRange(p.id));
                      setOpen(false);
                    }
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {value.preset === "custom" && (
              <div className="relative z-[1] mt-3 space-y-2 border-t border-[var(--g-border)] pt-3">
                <label className="block text-xs font-medium text-[var(--t-mid)]">
                  From
                  <input
                    type="date"
                    className="mt-1 h-10 w-full rounded-[12px] border border-[var(--g-border)] bg-[var(--input-bg)] px-2 text-sm text-[var(--t-hi)]"
                    value={format(value.from, "yyyy-MM-dd")}
                    onChange={(e) =>
                      onChange({
                        from: new Date(e.target.value),
                        to: value.to,
                        preset: "custom",
                      })
                    }
                  />
                </label>
                <label className="block text-xs font-medium text-[var(--t-mid)]">
                  To
                  <input
                    type="date"
                    className="mt-1 h-10 w-full rounded-[12px] border border-[var(--g-border)] bg-[var(--input-bg)] px-2 text-sm text-[var(--t-hi)]"
                    value={format(value.to, "yyyy-MM-dd")}
                    onChange={(e) =>
                      onChange({
                        from: value.from,
                        to: new Date(e.target.value),
                        preset: "custom",
                      })
                    }
                  />
                </label>
                <Button size="sm" className="w-full" onClick={() => setOpen(false)}>
                  Apply
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
