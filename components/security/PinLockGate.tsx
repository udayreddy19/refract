"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t, type Locale } from "@/lib/i18n";
import { useAppStore } from "@/store/app-store";

export function PinLockGate({ children }: { children: React.ReactNode }) {
  const token = useAppStore((s) => s.token);
  const locale = useAppStore((s) => s.locale);
  const pinEnabled = useAppStore((s) => s.pinEnabled);
  const unlockSession = useAppStore((s) => s.unlockSession);
  const sessionUnlocked = useAppStore((s) => s.sessionUnlocked);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !pinEnabled) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        useAppStore.getState().lockSession();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [token, pinEnabled]);

  if (!token || !pinEnabled || sessionUnlocked) {
    return <>{children}</>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/payflow/security.php", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "verify_pin", pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Incorrect PIN");
      }
      unlockSession();
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect PIN");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--bg)]/95 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="glass w-full max-w-sm rounded-[20px] p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--t-hi)]">
          {t(locale as Locale, "lockTitle")}
        </h2>
        <p className="mt-1 text-sm text-[var(--t-mid)]">Enter your 4–6 digit app PIN</p>
        <Input
          className="mt-4"
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-[var(--red)]">{error}</p>}
        <Button type="submit" className="mt-4 w-full" loading={busy}>
          {t(locale as Locale, "unlock")}
        </Button>
      </form>
    </div>
  );
}
