"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { adminApi } from "@/lib/admin-api";
import { payflowAdminApi, type PayflowAdminDashboard } from "@/lib/payflow-admin-api";
import { formatINR, formatNumber } from "@/lib/utils";

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="glass rounded-[20px] p-4">
      <p className="relative z-[1] text-sm text-[var(--t-mid)]">{label}</p>
      <p className="relative z-[1] mt-2 font-display text-2xl font-semibold text-[var(--t-hi)]">
        {value}
      </p>
      {sub && <p className="relative z-[1] mt-1 text-xs text-[var(--t-low)]">{sub}</p>}
    </div>
  );
}

function LoginView({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminApi.login(password);
      toast.success("Admin signed in");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(0,161,224,0.18),transparent_65%)] blur-2xl" />
      </div>
      <Card className="relative z-[1] w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[var(--brand-grad)] text-white shadow-[var(--s-btn-w)]">
            <Shield size={18} />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">PayFlow Admin</h1>
            <p className="text-sm text-[var(--t-mid)]">Control retailers & wallets</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Input
            type="password"
            label="Admin password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}

function DashboardView() {
  const [data, setData] = useState<PayflowAdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await payflowAdminApi.dashboard();
        if (!cancelled) setData(d);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 text-[var(--t-mid)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…
      </div>
    );
  }

  const { stats } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Retailers" value={formatNumber(stats.agents)} sub={`${stats.activeAgents} active`} />
        <Stat
          label="Disabled"
          value={formatNumber(stats.disabledAgents)}
          sub="Suspended accounts"
        />
        <Stat
          label="Wallet float"
          value={formatINR(stats.totalWalletBalance)}
          sub="All retailer balances"
        />
        <Stat
          label="Today volume"
          value={formatINR(stats.todayVolume)}
          sub={`${formatNumber(stats.ledgerEntries)} ledger rows`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Recent retailers">
          <div className="space-y-3">
            {data.recentAgents.length === 0 && (
              <p className="text-sm text-[var(--t-low)]">No retailers yet.</p>
            )}
            {data.recentAgents.map((a) => (
              <div
                key={a.uid}
                className="flex items-center justify-between gap-3 border-b border-[var(--g-border-lo)] pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="font-mono text-xs text-[var(--t-low)]">{a.agentId}</p>
                </div>
                <div className="text-right">
                  <Badge
                    className={
                      a.status === "disabled"
                        ? "bg-[var(--red-bg)] text-[var(--red)] border-[var(--red-border)]"
                        : "bg-[var(--green-bg)] text-[var(--green)] border-[var(--green-border)]"
                    }
                  >
                    {a.status}
                  </Badge>
                  <p className="mt-1 font-mono text-xs text-[var(--t-mid)]">
                    {formatINR(a.balance || 0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recent ledger">
          <div className="space-y-3">
            {data.recentLedger.length === 0 && (
              <p className="text-sm text-[var(--t-low)]">No wallet movements yet.</p>
            )}
            {data.recentLedger.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--g-border-lo)] pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium">{e.agentId || e.uid}</p>
                  <p className="text-xs text-[var(--t-low)]">
                    {e.type}
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                </div>
                <p
                  className={`font-mono text-sm ${
                    e.amount >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
                  }`}
                >
                  {e.amount >= 0 ? "+" : ""}
                  {formatINR(e.amount)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AdminHomePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await adminApi.me();
        if (!cancelled) setAuthed(true);
      } catch {
        if (!cancelled) setAuthed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--t-mid)]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return (
      <LoginView
        onSuccess={() => {
          setAuthed(true);
          setTick((t) => t + 1);
          router.refresh();
        }}
      />
    );
  }

  return (
    <AdminShell title="Dashboard">
      <DashboardView />
    </AdminShell>
  );
}
