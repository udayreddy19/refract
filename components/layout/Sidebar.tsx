"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  QrCode,
  BarChart3,
  UserCog,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { authService } from "@/lib/services";
import { formatINR } from "@/lib/utils";

export const portalNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/bill-payments", label: "Bill Payments", icon: Receipt },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/qr", label: "QR Collection", icon: QrCode },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: UserCog },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    sidebarCollapsed,
    sidebarMobileOpen,
    toggleSidebar,
    setSidebarMobileOpen,
    logout,
    walletBalance,
    user,
  } = useAppStore();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const content = (
    <div className="flex h-full flex-col bg-[var(--sidebar)]">
      <div className="flex h-16 items-center gap-2 border-b border-[var(--g-border)] px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[var(--brand-grad)] text-sm font-bold text-white shadow-[var(--s-btn-w)]">
          RX
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="font-display truncate text-sm font-semibold text-[var(--t-hi)]">
              ReconcileX
            </p>
            <p className="truncate text-xs text-[var(--t-low)]">Agent Wallet</p>
          </div>
        )}
        <button
          type="button"
          className="ml-auto rounded-lg p-1.5 text-[var(--t-mid)] hover:bg-[var(--brand-soft)] lg:hidden"
          onClick={() => setSidebarMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {!sidebarCollapsed && (
        <div className="mx-3 mt-3 rounded-[16px] bg-[var(--banner-grad)] p-3 text-white shadow-[var(--s-btn-w)]">
          <p className="text-[11px] font-medium opacity-80">Available balance</p>
          <p className="font-display text-lg font-bold tracking-tight">
            {formatINR(walletBalance)}
          </p>
          <p className="mt-1 truncate text-[11px] opacity-75">
            {user?.agentId || "Retailer"}
          </p>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main">
        {portalNav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-[var(--brand-soft)] text-[var(--brand-deep)] shadow-sm"
                  : "text-[var(--t-mid)] hover:bg-[var(--brand-soft)]/60 hover:text-[var(--t-hi)]",
                sidebarCollapsed && "justify-center px-2"
              )}
              title={item.label}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--g-border)] p-3">
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className={cn(
            "flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-medium text-[var(--t-mid)] hover:bg-[var(--red-bg)] hover:text-[var(--red)]",
            sidebarCollapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!sidebarCollapsed && <span>Logout</span>}
        </button>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Logout"
        description="Are you sure you want to logout?"
        confirmLabel="Logout"
        variant="danger"
        onConfirm={async () => {
          await authService.logout();
          logout();
          setLogoutOpen(false);
          router.push("/login");
        }}
      />
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "relative hidden h-screen shrink-0 border-r border-[var(--g-border)] bg-[var(--sidebar)] transition-all duration-200 lg:block",
          sidebarCollapsed ? "w-[72px]" : "w-[248px]"
        )}
      >
        {content}
        <button
          type="button"
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--g-border)] bg-[var(--surface)] text-[var(--t-mid)] shadow-md hover:text-[var(--brand)]"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </aside>

      {sidebarMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close menu"
            onClick={() => setSidebarMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[270px] shadow-[var(--s-float)]">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
