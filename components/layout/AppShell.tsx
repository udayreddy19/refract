"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/store/app-store";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { PinLockGate } from "@/components/security/PinLockGate";

const titles: Record<string, string> = {
  "/dashboard": "Home",
  "/bill-payments": "Bill Payments",
  "/wallet": "Wallet",
  "/qr": "QR Collection",
  "/reports": "Reports",
  "/profile": "Profile",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAppStore((s) => s.token);
  const setAuth = useAppStore((s) => s.setAuth);
  const setWalletBalance = useAppStore((s) => s.setWalletBalance);
  const logout = useAppStore((s) => s.logout);
  const title = titles[pathname] || "ReconcileX";

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      const { authService } = await import("@/lib/services");
      const session = await authService.session();
      if (cancelled) return;
      if (!session) {
        logout();
        router.replace("/login");
        return;
      }
      setAuth(session.user, token);
      setWalletBalance(session.balance);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router, setAuth, setWalletBalance, logout]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand)]/30 border-t-[var(--brand)]" />
      </div>
    );
  }

  return (
    <PinLockGate>
    <div className="relative z-[1] flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <BottomNav />
    </div>
    </PinLockGate>
  );
}
