"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowLeftRight,
  LogOut,
  Shield,
  Loader2,
  Store,
} from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeProvider";

type Perms = {
  canMutateUsers?: boolean;
  canReviewPayments?: boolean;
  canEditSettings?: boolean;
  canControl?: boolean;
};

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/agents", label: "Retailers", icon: Store },
  { href: "/admin/wallets", label: "Wallets", icon: Wallet },
  { href: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight },
];

export default function AdminShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState("viewer");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await adminApi.me();
        if (!cancelled) {
          setAuthed(true);
          setRole(me.admin?.role || "viewer");
        }
      } catch {
        if (!cancelled) {
          setAuthed(false);
          if (pathname !== "/admin") {
            router.replace("/admin");
          }
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  const logout = async () => {
    try {
      await adminApi.logout();
    } catch {
      // ignore
    }
    window.location.href = "/admin";
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-[var(--bg)] text-[var(--t-mid)]">
        <Loader2 size={22} className="animate-spin text-[var(--brand)]" />
        <span>Checking admin session…</span>
      </div>
    );
  }

  if (!authed && pathname !== "/admin") {
    return null;
  }

  if (!authed) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen bg-[var(--bg)] text-[var(--t-hi)]">
      <div className="relative z-[1] mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-[var(--g-border)] bg-[var(--sidebar)] p-4 lg:flex">
          <div className="mb-6 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--brand-grad)] text-white shadow-[var(--s-btn-w)]">
              <Shield size={16} />
            </div>
            <div>
              <p className="font-display text-sm font-semibold">ReconcileX Admin</p>
              <p className="text-xs text-[var(--t-low)]">Admin · {role}</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1" aria-label="Admin">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-[var(--brand-soft)] text-[var(--brand-deep)]"
                      : "text-[var(--t-mid)] hover:bg-[var(--brand-soft)]/70 hover:text-[var(--t-hi)]"
                  )}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-2 border-t border-[var(--g-border)] pt-3">
            <Link
              href="/login"
              className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm text-[var(--t-mid)] hover:bg-[var(--brand-soft)] hover:text-[var(--t-hi)]"
            >
              <Users size={15} />
              Agent portal
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm text-[var(--t-mid)] hover:bg-[var(--red-bg)] hover:text-[var(--red)]"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--g-border)] bg-[var(--header-bg)] px-4 py-4 backdrop-blur-xl sm:px-6">
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight">{title}</h1>
              <p className="text-xs text-[var(--t-low)] lg:hidden">
                ReconcileX Admin · {role}
              </p>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              <ThemeToggle />
              {NAV.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium lg:hidden",
                      active
                        ? "bg-[var(--brand)] text-white"
                        : "bg-[var(--input-bg)] text-[var(--t-mid)]"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={logout}
                className="rounded-full bg-[var(--input-bg)] px-3 py-1.5 text-xs text-[var(--t-mid)] hover:text-[var(--t-hi)] lg:hidden"
              >
                Sign out
              </button>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function canMutateAgents(role: string, perms?: Perms) {
  return role === "super" || Boolean(perms?.canMutateUsers);
}
