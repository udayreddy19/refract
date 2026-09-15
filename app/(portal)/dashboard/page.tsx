"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  QrCode,
  Receipt,
  Wallet,
  BarChart3,
  Plus,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { defaultRange, transactionService } from "@/lib/services";
import type { ChartPoint, DashboardStats, DateRange, Transaction } from "@/lib/types";
import { formatINR, formatNumber } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

const quickActions = [
  { href: "/wallet", label: "Add Money", icon: Plus, tone: "bg-[var(--brand-soft)] text-[var(--brand-deep)]" },
  { href: "/bill-payments", label: "Pay Bills", icon: Receipt, tone: "bg-[var(--green-bg)] text-[var(--green)]" },
  { href: "/qr", label: "Scan QR", icon: QrCode, tone: "bg-[var(--yellow-bg)] text-[var(--yellow)]" },
  { href: "/reports", label: "Reports", icon: BarChart3, tone: "bg-[var(--blue-bg)] text-[var(--blue)]" },
  { href: "/wallet", label: "Wallet", icon: Wallet, tone: "bg-[var(--brand-soft)] text-[var(--brand)]" },
];

function StatMini({
  title,
  count,
  volume,
  tone,
}: {
  title: string;
  count: number;
  volume: number;
  tone?: "success" | "danger" | "warning";
}) {
  const accent =
    tone === "success"
      ? "text-[var(--green)]"
      : tone === "danger"
        ? "text-[var(--red)]"
        : tone === "warning"
          ? "text-[var(--yellow)]"
          : "text-[var(--t-hi)]";
  return (
    <div className="glass rounded-[18px] p-4">
      <p className={`text-sm font-medium ${accent}`}>{title}</p>
      <p className="font-display mt-1 text-xl font-semibold text-[var(--t-hi)]">
        {formatNumber(count)}
      </p>
      <p className="mt-2 font-mono text-sm text-[var(--t-mid)]">{formatINR(volume)}</p>
    </div>
  );
}

export default function DashboardPage() {
  const user = useAppStore((s) => s.user);
  const walletBalance = useAppStore((s) => s.walletBalance);
  const [range, setRange] = useState<DateRange>(defaultRange("today"));
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartDays, setChartDays] = useState<1 | 7 | 30>(7);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, c, r] = await Promise.all([
          transactionService.dashboardStats(range),
          transactionService.chart(chartDays),
          transactionService.list({ page: 1, pageSize: 8 }),
        ]);
        if (!cancelled) {
          setStats(s);
          setChart(c);
          setRecent(r.data);
        }
      } catch {
        toast.error("Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range, chartDays]);

  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      { accessorKey: "transactionId", header: "Txn ID" },
      { accessorKey: "customerName", header: "Details" },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <span className="font-mono font-medium">{formatINR(row.original.amount)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <Badge status={row.original.status} />,
      },
      {
        accessorKey: "createdAt",
        header: "When",
        cell: ({ row }) =>
          format(new Date(row.original.createdAt), "dd MMM, HH:mm"),
      },
      {
        id: "action",
        header: "",
        cell: () => (
          <Button size="sm" variant="ghost" aria-label="View">
            <Eye className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <PageContainer>
      <div className="wallet-banner animate-rise mb-5 p-5 sm:p-6">
        <div className="relative z-[1] flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">
              Namaste{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
              Available balance
            </p>
            <p className="font-display mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {formatINR(walletBalance)}
            </p>
            <p className="mt-2 text-sm text-white/75">
              Agent ID · {user?.agentId || "—"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/wallet">
              <Button className="!bg-white !text-[var(--brand-deep)] hover:!bg-white/90">
                <ArrowDownLeft className="h-4 w-4" />
                Add money
              </Button>
            </Link>
            <Link href="/wallet">
              <Button
                variant="secondary"
                className="!border-white/30 !bg-white/15 !text-white hover:!bg-white/25"
              >
                <ArrowUpRight className="h-4 w-4" />
                Withdraw
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <section className="animate-rise animate-rise-delay-1 mb-6">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.label} href={a.href} className="quick-action">
                <span className={`quick-action-icon ${a.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-semibold text-[var(--t-mid)] sm:text-xs">
                  {a.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-base font-semibold text-[var(--t-hi)]">
          Today&apos;s overview
        </h2>
        <DatePicker value={range} onChange={setRange} />
      </div>

      <section className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <ArrowDownLeft className="h-4 w-4 text-[var(--green)]" />
          <h3 className="text-sm font-semibold text-[var(--t-hi)]">Money in</h3>
        </div>
        {loading || !stats ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass h-28 animate-pulse rounded-[18px]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatMini title="Total" count={stats.payIns.total.count} volume={stats.payIns.total.volume} />
            <StatMini title="Success" count={stats.payIns.success.count} volume={stats.payIns.success.volume} tone="success" />
            <StatMini title="Failed" count={stats.payIns.failed.count} volume={stats.payIns.failed.volume} tone="danger" />
          </div>
        )}
      </section>

      <section className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <ArrowUpRight className="h-4 w-4 text-[var(--yellow)]" />
          <h3 className="text-sm font-semibold text-[var(--t-hi)]">Money out</h3>
        </div>
        {loading || !stats ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="glass h-28 animate-pulse rounded-[18px]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatMini title="Total" count={stats.payOuts.total.count} volume={stats.payOuts.total.volume} />
            <StatMini title="Processed" count={stats.payOuts.processed.count} volume={stats.payOuts.processed.volume} tone="success" />
            <StatMini title="Failed" count={stats.payOuts.failed.count} volume={stats.payOuts.failed.volume} tone="danger" />
            <StatMini title="Pending" count={stats.payOuts.pending.count} volume={stats.payOuts.pending.volume} tone="warning" />
            <StatMini title="Refund" count={stats.payOuts.refund.count} volume={stats.payOuts.refund.volume} />
          </div>
        )}
      </section>

      <Card
        className="mb-6"
        title="Trends"
        action={
          <div className="flex gap-1 rounded-full border border-[var(--g-border)] bg-[var(--input-bg)] p-1">
            {([1, 7, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setChartDays(d)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  chartDays === d
                    ? "bg-[var(--brand)] text-white"
                    : "text-[var(--t-mid)] hover:text-[var(--t-hi)]"
                }`}
              >
                {d === 1 ? "Today" : `${d}d`}
              </button>
            ))}
          </div>
        }
      >
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--g-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--t-low)" }} stroke="var(--g-border)" />
              <YAxis tick={{ fontSize: 12, fill: "var(--t-low)" }} stroke="var(--g-border)" />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--g-border)",
                  borderRadius: 12,
                  color: "var(--t-hi)",
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="payIn" name="In" stroke="#00A1E0" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="payOut" name="Out" stroke="#F4A100" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="success" name="Success" stroke="#0F9D58" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="failed" name="Failed" stroke="#E53935" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Recent activity">
        <DataTable columns={columns} data={recent} loading={loading} emptyTitle="No transactions yet" />
      </Card>
    </PageContainer>
  );
}
