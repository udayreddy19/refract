"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/store/app-store";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/bill-payments": "Bill Payments",
  "/wallet": "Wallet",
  "/qr": "QR Collection",
  "/reports": "Reports",
  "/profile": "Profile & Settings",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAppStore((s) => s.token);
  const title = titles[pathname] || "PayFlow Agent";

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  return (
    <div className="relative z-[1] flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
