"use client";

import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 rounded-full border border-[var(--g-border)] bg-[var(--input-bg)] p-1",
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative rounded-full px-4 py-2 text-sm font-medium transition-all",
            active === tab.id
              ? "bg-[var(--brand)] text-white shadow-[var(--s-btn-w)]"
              : "text-[var(--t-mid)] hover:bg-[var(--brand-soft)] hover:text-[var(--t-hi)]"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
