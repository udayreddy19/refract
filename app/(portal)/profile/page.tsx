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
import { CURRENT_USER } from "@/lib/mock-data";
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
          checked ? "bg-white" : "bg-white/15"
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
  const user = storeUser ?? CURRENT_USER;

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
      await authService.changePasscode(values.current, values.next, user.agentId);
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
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Profile & Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your agent account and security preferences</p>
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
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-[var(--t-hi)]">
              <KeyRound className="h-4 w-4" />
            </span>
          }
        >
          <p className="mb-4 text-sm text-muted">
            Update your agent passcode regularly to keep your PayFlow account secure.
          </p>
          <Button type="button" onClick={() => setPasscodeOpen(true)}>
            Change Passcode
          </Button>
        </Card>

        <Card
          title="Security"
          action={
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-[var(--t-hi)]">
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
            <div className="rounded-[10px] border border-border bg-background px-4 py-3">
              <p className="text-sm font-medium text-foreground">Session management</p>
              <p className="mt-1 text-xs text-muted">
                You are signed in on this browser. Signing out clears your local session token.
                Active device review and remote logout will be available once the backend session API is connected.
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
