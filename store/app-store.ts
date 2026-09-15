"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgentUser, NotificationItem } from "@/lib/types";

interface AppState {
  user: AgentUser | null;
  token: string | null;
  walletBalance: number;
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  notifications: NotificationItem[];
  twoFactorEnabled: boolean;
  loginNotifications: boolean;
  setAuth: (user: AgentUser, token: string, balance?: number) => void;
  logout: () => void;
  setWalletBalance: (balance: number) => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setSidebarMobileOpen: (v: boolean) => void;
  setTwoFactor: (v: boolean) => void;
  setLoginNotifications: (v: boolean) => void;
  markNotificationsRead: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      walletBalance: 0,
      theme: "light",
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
      notifications: [],
      twoFactorEnabled: false,
      loginNotifications: true,
      setAuth: (user, token, balance) =>
        set({
          user,
          token,
          ...(typeof balance === "number" ? { walletBalance: balance } : {}),
        }),
      logout: () => set({ user: null, token: null, walletBalance: 0 }),
      setWalletBalance: (walletBalance) => set({ walletBalance }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setSidebarMobileOpen: (sidebarMobileOpen) => set({ sidebarMobileOpen }),
      setTwoFactor: (twoFactorEnabled) => set({ twoFactorEnabled }),
      setLoginNotifications: (loginNotifications) => set({ loginNotifications }),
      markNotificationsRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),
    }),
    {
      name: "payflow-agent-store",
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        walletBalance: s.walletBalance,
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        twoFactorEnabled: s.twoFactorEnabled,
        loginNotifications: s.loginNotifications,
      }),
    }
  )
);
