"use client";

import { useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Eye, TrendingDown, TrendingUp } from "lucide-react";
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

function StatCard({
  title,
  count,
  volume,
  tone = "default",
}: {
  title: string;
  count: number;
  volume: number;
  tone?: "default" | "success" | "danger" | "warning" | "primary";
}) {
  const tones = {
    default: "",
    success: "!border-[var(--green-border)]",
    danger: "!border-[var(--red-border)]",
    warning: "!border-[var(--yellow-border)]",
    primary: "!border-white/20",
  };
  const accents = {
    default: "text-[var(--t-hi)]",
    success: "text-[var(--green)]",
    danger: "text-[var(--red)]",
    warning: "text-[var(--yellow)]",
    primary: "text-[var(--t-hi)]",
  };
  return (
    <div className={`glass rounded-[20px] p-4 ${tones[tone]}`}>
      <p className={`relative z-[1] text-sm font-medium ${accents[tone]}`}>{title}</p>
      <p className="relative z-[1] mt-2 font-display text-2xl font-semibold text-[var(--t-hi)]">
        {formatNumber(count)}
      </p>
      <p className="relative z-[1] mt-1 text-xs text-[var(--t-low)]">Count</p>
      <div className="relative z-[1] mt-3 border-t border-white/10 pt-3">
        <p className="font-mono text-base font-medium text-[var(--t-hi)]">{formatINR(volume)}</p>
        <p className="text-xs text-[var(--t-low)]">Order Volume</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
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
      { accessorKey: "transactionId", header: "Transaction ID" },
      { accessorKey: "customerName", header: "Customer" },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <span className="capitalize">{row.original.type.replace("_", " ")}</span>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => formatINR(row.original.amount),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <Badge status={row.original.status} />,
      },
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }) => format(new Date(row.original.createdAt), "dd MMM yyyy, HH:mm"),
      },
      {
        id: "action",
        header: "Action",
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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-[var(--t-mid)]">Overview of pay-ins and pay-outs</p>
        </div>
        <DatePicker value={range} onChange={setRange} />
      </div>

      <section className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[var(--green)]" />
          <h2 className="font-display text-base font-semibold text-[var(--t-hi)]">PayIns</h2>
        </div>
        {loading || !stats ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass h-36 animate-pulse rounded-[20px]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard title="Total" count={stats.payIns.total.count} volume={stats.payIns.total.volume} tone="primary" />
            <StatCard title="Success" count={stats.payIns.success.count} volume={stats.payIns.success.volume} tone="success" />
            <StatCard title="Failed" count={stats.payIns.failed.count} volume={stats.payIns.failed.volume} tone="danger" />
          </div>
        )}
      </section>

      <section className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-[var(--yellow)]" />
          <h2 className="font-display text-base font-semibold text-[var(--t-hi)]">Pay Outs</h2>
        </div>
        {loading || !stats ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="glass h-36 animate-pulse rounded-[20px]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard title="Total" count={stats.payOuts.total.count} volume={stats.payOuts.total.volume} />
            <StatCard title="Processed" count={stats.payOuts.processed.count} volume={stats.payOuts.processed.volume} tone="success" />
            <StatCard title="Failed" count={stats.payOuts.failed.count} volume={stats.payOuts.failed.volume} tone="danger" />
            <StatCard title="Pending" count={stats.payOuts.pending.count} volume={stats.payOuts.pending.volume} tone="warning" />
            <StatCard title="Refund" count={stats.payOuts.refund.count} volume={stats.payOuts.refund.volume} tone="primary" />
          </div>
        )}
      </section>

      <Card
        className="mb-6"
        title="Transaction Trends"
        action={
          <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {([1, 7, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setChartDays(d)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  chartDays === d
                    ? "bg-white text-[#0a0b10]"
                    : "text-[var(--t-mid)] hover:text-[var(--t-hi)]"
                }`}
              >
                {d === 1 ? "Today" : `${d} days`}
              </button>
            ))}
          </div>
        }
      >
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "rgba(255,255,255,0.45)" }} stroke="rgba(255,255,255,0.15)" />
              <YAxis tick={{ fontSize: 12, fill: "rgba(255,255,255,0.45)" }} stroke="rgba(255,255,255,0.15)" />
              <Tooltip
                contentStyle={{
                  background: "rgba(12,13,24,0.95)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12,
                  color: "#fff",
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="payIn" name="PayIn volume" stroke="#93C5FD" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="payOut" name="PayOut volume" stroke="#FCD34D" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="success" name="Successful" stroke="#34D399" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="failed" name="Failed" stroke="#F87171" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Recent Transactions">
        <DataTable columns={columns} data={recent} loading={loading} />
      </Card>
    </PageContainer>
  );
}
