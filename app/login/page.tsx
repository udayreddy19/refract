"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/lib/services";
import { useAppStore } from "@/store/app-store";

const schema = z.object({
  agentId: z.string().min(1, "Agent ID is required"),
  passcode: z.string().min(4, "Passcode is required"),
  remember: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { token, setAuth } = useAppStore();
  const [showPass, setShowPass] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { agentId: "", passcode: "", remember: true },
  });

  useEffect(() => {
    if (token) router.replace("/dashboard");
  }, [token, router]);

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await authService.login(values.agentId, values.passcode);
      setAuth(res.user, res.token);
      toast.success("Login successful");
      router.push("/dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    }
  };

  return (
    <div className="relative z-[1] flex min-h-screen items-center justify-center px-4">
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white text-lg font-bold text-[#0a0b10] shadow-[var(--s-btn-w)]">
            PF
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            <span className="gradient-text">PayFlow Agent</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--t-mid)]">Sign in to your retailer portal</p>
        </div>

        <div className="glass rounded-[24px] p-6 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="relative z-[1] space-y-4">
            <Input
              label="Mobile Number / Agent ID"
              placeholder="Enter Agent ID"
              autoComplete="username"
              error={errors.agentId?.message}
              {...register("agentId")}
              required
            />
            <div className="relative">
              <Input
                label="Passcode"
                type={showPass ? "text" : "password"}
                placeholder="Enter passcode"
                autoComplete="current-password"
                error={errors.passcode?.message}
                {...register("passcode")}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-[38px] text-[var(--t-mid)] hover:text-[var(--t-hi)]"
                onClick={() => setShowPass((s) => !s)}
                aria-label={showPass ? "Hide passcode" : "Show passcode"}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-[var(--t-mid)]">
                <input
                  type="checkbox"
                  className="rounded border-white/20 bg-white/5"
                  {...register("remember")}
                />
                Remember me
              </label>
              <button
                type="button"
                className="text-[var(--t-hi)] hover:underline"
                onClick={() => toast.message("Contact support to reset your passcode.")}
              >
                Forgot Passcode?
              </button>
            </div>

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Login
            </Button>
          </form>

          <div className="relative z-[1] mt-5 border-t border-white/10 pt-5">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 text-sm text-[var(--t-mid)] hover:text-[var(--t-hi)]"
              onClick={() => {
                setOtpMode(true);
                setOtpSent(true);
                toast.success("OTP sent to registered mobile (demo)");
              }}
            >
              <ShieldCheck className="h-4 w-4" />
              {otpMode && otpSent ? "OTP sent — use passcode login for demo" : "Login with OTP"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
