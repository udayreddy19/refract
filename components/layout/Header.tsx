"use client";

import { Bell, Menu } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useState } from "react";

export function Header({ title }: { title?: string }) {
  const { user, setSidebarMobileOpen, notifications, markNotificationsRead } =
    useAppStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-white/10 bg-[#07080f]/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-lg p-2 text-[var(--t-mid)] hover:bg-white/10 lg:hidden"
          onClick={() => setSidebarMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {title && (
          <h1 className="font-display text-lg font-semibold tracking-tight text-[var(--t-hi)] sm:text-xl">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <div className="relative">
          <button
            type="button"
            className="relative rounded-full p-2 text-[var(--t-mid)] hover:bg-white/10 hover:text-[var(--t-hi)]"
            aria-label="Notifications"
            onClick={() => {
              setNotifOpen((o) => !o);
              markNotificationsRead();
            }}
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--red)]" />
            )}
          </button>
          {notifOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40"
                aria-label="Close notifications"
                onClick={() => setNotifOpen(false)}
              />
              <div className="glass absolute right-0 z-50 mt-2 w-80 rounded-[16px] p-2 shadow-[var(--s-float)]">
                <p className="relative z-[1] px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--t-low)]">
                  Notifications
                </p>
                {notifications.length === 0 ? (
                  <p className="relative z-[1] px-2 py-4 text-sm text-[var(--t-mid)]">
                    No notifications
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className="relative z-[1] rounded-[12px] px-2 py-2 hover:bg-white/[0.05]"
                    >
                      <p className="text-sm font-medium text-[var(--t-hi)]">{n.title}</p>
                      <p className="text-xs text-[var(--t-mid)]">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2.5 border-l border-white/10 pl-3 sm:pl-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white text-xs font-semibold text-[#0a0b10]">
            {user?.avatarInitials || "AU"}
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-medium text-[var(--t-hi)]">
              {user?.name || "Agent"}
            </p>
            <p className="truncate text-xs text-[var(--t-low)]">{user?.agentId}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
