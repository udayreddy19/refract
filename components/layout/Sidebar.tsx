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

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bill-payments", label: "Bill Payments", icon: Receipt },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/qr", label: "QR Collection", icon: QrCode },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/profile", label: "Profile & Settings", icon: UserCog },
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
  } = useAppStore();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-white/20 bg-white text-sm font-bold text-[#0a0b10] shadow-[var(--s-btn-w)]">
          PF
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="font-display truncate text-sm font-semibold text-[var(--t-hi)]">
              PayFlow Agent
            </p>
            <p className="truncate text-xs text-[var(--t-low)]">Retailer Portal</p>
          </div>
        )}
        <button
          type="button"
          className="ml-auto rounded-lg p-1.5 text-[var(--t-mid)] hover:bg-white/10 lg:hidden"
          onClick={() => setSidebarMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-white/12 text-[var(--t-hi)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] border border-white/10"
                  : "text-[var(--t-mid)] border border-transparent hover:bg-white/[0.05] hover:text-[var(--t-hi)]",
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

      <div className="border-t border-white/10 p-3">
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
        onConfirm={() => {
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
          "glass relative hidden h-screen shrink-0 transition-all duration-200 lg:block",
          sidebarCollapsed ? "w-[72px]" : "w-[240px]"
        )}
        style={{ borderRadius: 0, borderLeft: "none", borderTop: "none", borderBottom: "none" }}
      >
        {content}
        <button
          type="button"
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-[#0c0d18] text-[var(--t-mid)] shadow-lg hover:text-[var(--t-hi)]"
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
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setSidebarMobileOpen(false)}
          />
          <aside className="glass absolute left-0 top-0 h-full w-[260px] shadow-[var(--s-float)]" style={{ borderRadius: 0 }}>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
