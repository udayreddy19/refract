"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import AuthModal from "@/components/AuthModal";
import { getUserSession, getPublicSettings, signOutUser, type UserSession } from "@/lib/auth";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "What's new" },
  { href: "/#faq", label: "FAQ" },
  { href: "/status", label: "Status" },
];

export default function SiteNav({
  returnTo = "/",
  showToolLink = false,
  user: controlledUser,
  onUserChange,
  onRequestSignIn,
}: {
  returnTo?: string;
  showToolLink?: boolean;
  user?: UserSession | null;
  onUserChange?: (user: UserSession | null) => void;
  onRequestSignIn?: () => void;
}) {
  const pathname = usePathname();
  const [internalUser, setInternalUser] = useState<UserSession | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<{
    enabled?: boolean;
    message?: string;
    level?: string;
  } | null>(null);

  const isControlled = controlledUser !== undefined;
  const user = isControlled ? controlledUser : internalUser;

  useEffect(() => {
    const timer = setTimeout(() => {
      void getPublicSettings()
        .then((s) => {
          if (s?.announcement?.enabled && s.announcement.message) {
            setAnnouncement(s.announcement);
          }
        })
        .catch(() => undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isControlled) return;
    const timer = setTimeout(() => {
      void getUserSession()
        .then((session) => {
          setInternalUser(session);
          onUserChange?.(session);
        })
        .catch(() => {
          setInternalUser(null);
          onUserChange?.(null);
        });
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname, isControlled, onUserChange]);

  const setUser = (next: UserSession | null) => {
    if (!isControlled) setInternalUser(next);
    onUserChange?.(next);
  };

  const openSignIn = () => {
    if (onRequestSignIn) onRequestSignIn();
    else setShowAuth(true);
  };

  const links = showToolLink
    ? [{ href: "/#tool", label: "Run recon" }, ...NAV_LINKS]
    : NAV_LINKS;

  return (
    <>
      {announcement?.enabled && announcement.message && (
        <div className={`site-announcement ${announcement.level || "info"}`}>
          {announcement.message}
        </div>
      )}
      <nav className="nav site-nav">
        <Link href="/" className="nav-logo">
          <div className="nav-logo-mark">RX</div>
          ReconcileX
        </Link>

        <div className="site-nav-links">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="site-nav-link">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="site-nav-actions">
          <ThemeToggle />
          {user ? (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="site-user-btn"
                onClick={() => setShowUserMenu((v) => !v)}
                aria-expanded={showUserMenu}
              >
                <span className="site-user-avatar">{user.avatar}</span>
                <span className="site-user-name">{user.name.split(" ")[0]}</span>
                <ChevronDown size={13} />
              </button>
              <AnimatePresence>
                {showUserMenu && (
                  <>
                    <div className="site-menu-backdrop" onClick={() => setShowUserMenu(false)} />
                    <motion.div
                      className="site-user-menu"
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.18 }}
                    >
                      <div className="site-user-menu-head">
                        <div className="site-user-menu-name">{user.name}</div>
                        <div className="site-user-menu-email">{user.email}</div>
                        <div className="site-user-menu-plan">
                          {user.isPro
                            ? `Pro · ${user.selectedPlan || "active"}`
                            : user.paymentStatus === "pending"
                              ? "Payment under review"
                              : "Free plan"}
                        </div>
                      </div>
                      <Link href="/account" className="site-user-menu-item" onClick={() => setShowUserMenu(false)}>
                        Account
                      </Link>
                      <Link href="/connections" className="site-user-menu-item" onClick={() => setShowUserMenu(false)}>
                        Connections
                      </Link>
                      <Link href="/pricing" className="site-user-menu-item" onClick={() => setShowUserMenu(false)}>
                        Pricing
                      </Link>
                      <button
                        type="button"
                        className="site-user-menu-item danger"
                        onClick={async () => {
                          await signOutUser();
                          setUser(null);
                          setShowUserMenu(false);
                        }}
                      >
                        <LogOut size={14} />
                        Sign out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={openSignIn}>
              Sign in
            </button>
          )}
          <button
            type="button"
            className="site-nav-burger"
            aria-label="Menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="site-mobile-drawer"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="site-mobile-link"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {!user && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 8 }}
                onClick={() => {
                  setMobileOpen(false);
                  openSignIn();
                }}
              >
                Sign in
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!onRequestSignIn && (
        <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} returnTo={returnTo} />
      )}
    </>
  );
}
