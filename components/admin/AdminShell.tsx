"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Shield,
  Loader2,
  BarChart3,
  SlidersHorizontal,
} from "lucide-react";
import { adminApi } from "@/lib/admin-api";

type Perms = {
  canMutateUsers?: boolean;
  canReviewPayments?: boolean;
  canEditSettings?: boolean;
  canControl?: boolean;
};

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users, need: "users" as const },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/control", label: "Control", icon: SlidersHorizontal, need: "control" as const },
  { href: "/admin/audit", label: "Audit", icon: Shield },
  { href: "/admin/settings", label: "Settings", icon: Settings },
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
  const [perms, setPerms] = useState<Perms>({});

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        try {
          const me = await adminApi.me();
          if (!cancelled) {
            setAuthed(true);
            setRole(me.admin?.role || "viewer");
            setPerms(me.permissions || {});
            if (pathname.startsWith("/admin/control") && me.admin?.role !== "super") {
              router.replace("/admin");
            }
            if (pathname.startsWith("/admin/users") && me.admin?.role !== "super") {
              // viewers/billing can view users list (GET) — keep
            }
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
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
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
      <div className="admin-loading">
        <Loader2 size={22} className="admin-spin" />
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

  const visibleNav = NAV.filter((item) => {
    if (item.need === "control" && !perms.canControl) return false;
    return true;
  });

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark">
            <Shield size={16} />
          </div>
          <div>
            <div className="admin-brand-title">ReconcileX</div>
            <div className="admin-brand-sub">Admin · {role}</div>
          </div>
        </div>

        <nav className="admin-nav">
          {visibleNav.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-nav-link ${active ? "active" : ""}`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button type="button" className="admin-logout" onClick={logout}>
          <LogOut size={15} />
          Sign out
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <h1>{title}</h1>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--t-dim)", textTransform: "uppercase" }}>{role}</span>
            <Link href="/" className="admin-site-link">
              View site
            </Link>
          </div>
        </header>
        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
