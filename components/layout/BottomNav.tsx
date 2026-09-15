"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  QrCode,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/bill-payments", label: "Bills", icon: Receipt },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/qr", label: "Scan", icon: QrCode },
  { href: "/profile", label: "Profile", icon: UserCog },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav lg:hidden" aria-label="Primary">
      {tabs.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(active && "active")}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
