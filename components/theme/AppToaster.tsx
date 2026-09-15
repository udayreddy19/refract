"use client";

import { Toaster } from "sonner";
import { useAppStore } from "@/store/app-store";

export function AppToaster() {
  const theme = useAppStore((s) => s.theme);
  return (
    <Toaster
      theme={theme}
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        className: "border border-[var(--g-border)] !bg-[var(--surface)] !text-[var(--t-hi)]",
      }}
    />
  );
}
