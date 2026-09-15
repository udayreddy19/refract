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
import { ThemeToggle } from "@/components/theme/ThemeProvider";
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
      setAuth(res.user, res.token, res.balance);
      toast.success("Login successful");
      router.push("/dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    }
  };

  return (
    <div className="relative z-[1] flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--brand-grad)] text-sm font-bold text-white shadow-[var(--s-btn-w)]">
            RX
          </div>
          <span className="font-display text-base font-semibold text-[var(--t-hi)]">
            ReconcileX
          </span>
        </div>
        <ThemeToggle />
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-10">
        <div className="wallet-banner animate-rise mb-6 p-6">
          <div className="relative z-[1]">
            <p className="text-sm font-medium text-white/80">Retailer portal</p>
            <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-white">
              ReconcileX Agent
            </h1>
            <p className="mt-2 max-w-xs text-sm text-white/75">
              Bills, wallet top-ups, QR collections — like your everyday UPI app.
            </p>
          </div>
        </div>

        <div className="glass animate-rise animate-rise-delay-1 rounded-[24px] p-6 sm:p-7">
          <div className="relative z-[1] mb-5 flex items-center gap-2 text-[var(--brand-deep)]">
            <ShieldCheck className="h-5 w-5" />
            <p className="text-sm font-semibold">Secure agent login</p>
          </div>

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
                className="absolute right-3 top-[38px] text-[var(--t-mid)] hover:text-[var(--brand)]"
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
                  className="rounded border-[var(--g-border)] accent-[var(--brand)]"
                  {...register("remember")}
                />
                Remember me
              </label>
              <button
                type="button"
                className="font-medium text-[var(--brand-deep)] hover:underline"
                onClick={() => toast.message("Contact support to reset your passcode.")}
              >
                Forgot Passcode?
              </button>
            </div>

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Login
            </Button>
          </form>

          <div className="relative z-[1] mt-4">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={async () => {
                try {
                  const res = await authService.loginWithGoogle();
                  setAuth(res.user, res.token, res.balance);
                  toast.success("Signed in with Google");
                  router.push("/dashboard");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Google sign-in failed"
                  );
                }
              }}
            >
              Continue with Google
            </Button>
          </div>

          <p className="relative z-[1] mt-5 text-center text-xs text-[var(--t-low)]">
            Need access? Ask your admin to create a retailer account.
          </p>
        </div>
      </div>
    </div>
  );
}
