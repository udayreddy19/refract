"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgentUser, NotificationItem } from "@/lib/types";
import { CURRENT_USER, MOCK_WALLET_BALANCE } from "@/lib/mock-data";

interface AppState {
  user: AgentUser | null;
  token: string | null;
  walletBalance: number;
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  notifications: NotificationItem[];
  twoFactorEnabled: boolean;
  loginNotifications: boolean;
  setAuth: (user: AgentUser, token: string) => void;
  logout: () => void;
  setWalletBalance: (balance: number) => void;
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
      walletBalance: MOCK_WALLET_BALANCE,
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
      notifications: [
        {
          id: "n1",
          title: "Withdrawal processing",
          message: "Your withdrawal of ₹10,000 is being processed.",
          read: false,
          createdAt: new Date().toISOString(),
        },
        {
          id: "n2",
          title: "Bill payment success",
          message: "Electricity bill paid successfully.",
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
      twoFactorEnabled: false,
      loginNotifications: true,
      setAuth: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
      setWalletBalance: (walletBalance) => set({ walletBalance }),
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
        sidebarCollapsed: s.sidebarCollapsed,
        twoFactorEnabled: s.twoFactorEnabled,
        loginNotifications: s.loginNotifications,
      }),
    }
  )
);

export { CURRENT_USER };
