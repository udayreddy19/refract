"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Eye, EyeOff, KeyRound, Shield } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { authService } from "@/lib/services";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

const passcodeSchema = z
  .object({
    current: z.string().min(1, "Current passcode is required"),
    next: z.string().min(6, "New passcode must be at least 6 characters"),
    confirm: z.string().min(1, "Confirm passcode is required"),
  })
  .refine((v) => v.next === v.confirm, {
    message: "Passcodes do not match",
    path: ["confirm"],
  });

type PasscodeValues = z.infer<typeof passcodeSchema>;

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[10px] border border-border bg-background px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-[var(--brand)]" : "bg-[var(--t-dim)]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5"
          )}
        />
      </button>
    </div>
  );
}

export default function ProfilePage() {
  const storeUser = useAppStore((s) => s.user);
  const twoFactorEnabled = useAppStore((s) => s.twoFactorEnabled);
  const setTwoFactor = useAppStore((s) => s.setTwoFactor);
  const loginNotifications = useAppStore((s) => s.loginNotifications);
  const setLoginNotifications = useAppStore((s) => s.setLoginNotifications);
  const pinEnabled = useAppStore((s) => s.pinEnabled);
  const setPinEnabled = useAppStore((s) => s.setPinEnabled);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const user = storeUser;

  const [passcodeOpen, setPasscodeOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasscodeValues>({
    resolver: zodResolver(passcodeSchema),
    defaultValues: { current: "", next: "", confirm: "" },
  });

  if (!user) {
    return (
      <PageContainer>
        <p className="text-sm text-[var(--t-mid)]">Loading profile…</p>
      </PageContainer>
    );
  }

  const closePasscode = () => {
    setPasscodeOpen(false);
    reset();
    setShowCurrent(false);
    setShowNext(false);
    setShowConfirm(false);
  };

  const onChangePasscode = async (values: PasscodeValues) => {
    setSubmitting(true);
    try {
      await authService.changePasscode(values.current, values.next);
      closePasscode();
      setSuccessOpen(true);
      toast.success("Passcode updated successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to change passcode");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer>
      <div className="wallet-banner mb-6 p-5">
        <div className="relative z-[1]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
            Account
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-white">
            Profile & Settings
          </h1>
          <p className="mt-1 text-sm text-white/75">
            Manage your agent account and security preferences
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        <Card title="Profile Information">
          <div className="space-y-4">
            <Input label="User Name" value={user.name} readOnly disabled />
            <Input label="Mobile Number" value={user.mobile} readOnly disabled />
            <Input label="Email Address" value={user.email} readOnly disabled />
          </div>
        </Card>

        <Card
          title="Authentication"
          action={
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-deep)]">
              <KeyRound className="h-4 w-4" />
            </span>
          }
        >
          <p className="mb-4 text-sm text-muted">
            Update your agent passcode regularly to keep your ReconcileX account secure.
          </p>
          <Button type="button" onClick={() => setPasscodeOpen(true)}>
            Change Passcode
          </Button>
        </Card>

        <Card
          title="Security"
          action={
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-deep)]">
              <Shield className="h-4 w-4" />
            </span>
          }
        >
          <div className="space-y-3">
            <Toggle
              checked={twoFactorEnabled}
              onChange={setTwoFactor}
              label="Two-factor authentication"
              description="Require a second verification step when signing in from a new device."
            />
            <Toggle
              checked={loginNotifications}
              onChange={setLoginNotifications}
              label="Login notifications"
              description="Get alerts when your agent account is accessed from a new session."
            />
            <Toggle
              checked={pinEnabled}
              onChange={async (v) => {
                if (v) {
                  const pin = window.prompt("Set a 4–6 digit app PIN");
                  if (!pin || !/^\d{4,6}$/.test(pin)) {
                    toast.error("PIN must be 4–6 digits");
                    return;
                  }
                  try {
                    const token = useAppStore.getState().token;
                    const res = await fetch("/api/payflow/security.php", {
                      method: "POST",
                      credentials: "include",
                      headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                      body: JSON.stringify({ action: "set_pin", pin }),
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error((data as { error?: string }).error || "Failed");
                    }
                    setPinEnabled(true);
                    toast.success("App PIN enabled");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to set PIN");
                  }
                } else {
                  try {
                    const token = useAppStore.getState().token;
                    await fetch("/api/payflow/security.php", {
                      method: "POST",
                      credentials: "include",
                      headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                      body: JSON.stringify({ action: "clear_pin" }),
                    });
                    setPinEnabled(false);
                    toast.success("App PIN disabled");
                  } catch {
                    toast.error("Failed to clear PIN");
                  }
                }
              }}
              label="App PIN lock"
              description="Lock the portal when you leave the tab."
            />
            <div className="rounded-[10px] border border-border bg-background px-4 py-3">
              <p className="text-sm font-medium text-foreground">Language / भाषा</p>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={locale === "en" ? "primary" : "secondary"}
                  onClick={() => setLocale("en")}
                >
                  English
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={locale === "hi" ? "primary" : "secondary"}
                  onClick={() => setLocale("hi")}
                >
                  हिन्दी
                </Button>
              </div>
            </div>
            <div className="rounded-[10px] border border-border bg-background px-4 py-3">
              <p className="text-sm font-medium text-foreground">Invite sub-retailer</p>
              <Button
                type="button"
                className="mt-2"
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/payflow/security.php", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "invite" }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed");
                    toast.success(`Invite code: ${data.inviteCode}`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                }}
              >
                Generate invite code
              </Button>
            </div>
            <div className="rounded-[10px] border border-border bg-background px-4 py-3">
              <p className="text-sm font-medium text-foreground">Session management</p>
              <p className="mt-1 text-xs text-muted">
                You are signed in on this browser. Signing out clears your local session token.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={passcodeOpen}
        onClose={closePasscode}
        title="Change Passcode"
        description="Enter your current passcode and choose a new one."
        size="sm"
      >
        <form onSubmit={handleSubmit(onChangePasscode)} className="space-y-4">
          <div className="relative">
            <Input
              label="Current Passcode"
              type={showCurrent ? "text" : "password"}
              required
              autoComplete="current-password"
              error={errors.current?.message}
              {...register("current")}
            />
            <button
              type="button"
              className="absolute right-3 top-9 text-muted hover:text-foreground"
              onClick={() => setShowCurrent((v) => !v)}
              aria-label={showCurrent ? "Hide current passcode" : "Show current passcode"}
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative">
            <Input
              label="New Passcode"
              type={showNext ? "text" : "password"}
              required
              autoComplete="new-password"
              error={errors.next?.message}
              {...register("next")}
            />
            <button
              type="button"
              className="absolute right-3 top-9 text-muted hover:text-foreground"
              onClick={() => setShowNext((v) => !v)}
              aria-label={showNext ? "Hide new passcode" : "Show new passcode"}
            >
              {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative">
            <Input
              label="Confirm Passcode"
              type={showConfirm ? "text" : "password"}
              required
              autoComplete="new-password"
              error={errors.confirm?.message}
              {...register("confirm")}
            />
            <button
              type="button"
              className="absolute right-3 top-9 text-muted hover:text-foreground"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? "Hide confirm passcode" : "Show confirm passcode"}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={closePasscode}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} className="flex-1">
              {submitting ? "Updating..." : "Update Passcode"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Passcode Updated"
        size="sm"
      >
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <p className="text-sm text-muted">
            Your passcode has been changed successfully. Use the new passcode for your next login.
          </p>
          <Button className="w-full" onClick={() => setSuccessOpen(false)}>
            Done
          </Button>
        </div>
      </Modal>
    </PageContainer>
  );
}
