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
        "flex flex-wrap gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 backdrop-blur-md",
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
              ? "bg-white text-[#0a0b10] shadow-[var(--s-btn-w)]"
              : "text-[var(--t-mid)] hover:bg-white/[0.06] hover:text-[var(--t-hi)]"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
