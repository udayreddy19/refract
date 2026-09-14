"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { transactionService } from "@/lib/services";
import type { Transaction, TransactionType } from "@/lib/types";
import { downloadCSV, formatINR, todayISO } from "@/lib/utils";

type ReportTab = "funds" | "transactions" | "payins" | "payouts" | "bill" | "qr";

const TABS: { id: ReportTab; label: string; filePrefix: string }[] = [
  { id: "funds", label: "Funds", filePrefix: "funds" },
  { id: "transactions", label: "Transactions", filePrefix: "transactions" },
  { id: "payins", label: "PayIns", filePrefix: "payins" },
  { id: "payouts", label: "PayOuts", filePrefix: "payouts" },
  { id: "bill", label: "Bill Payments", filePrefix: "bill-payments" },
  { id: "qr", label: "QR Collection", filePrefix: "qr-collection" },
];

const TAB_TYPES: Record<ReportTab, TransactionType[] | "all"> = {
  funds: ["wallet_add", "wallet_withdraw"],
  transactions: "all",
  payins: ["payin"],
  payouts: ["payout"],
  bill: ["bill"],
  qr: ["qr"],
};

function matchesTab(tx: Transaction, tab: ReportTab) {
  const mapping = TAB_TYPES[tab];
  if (mapping === "all") return true;
  return mapping.includes(tx.type);
}

function typeLabel(type: TransactionType) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("funds");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ search: "", from: "", to: "" });
  const [allRows, setAllRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const range =
          applied.from || applied.to
            ? {
                from: applied.from ? new Date(applied.from) : new Date("2000-01-01"),
                to: applied.to ? new Date(applied.to) : new Date(),
                preset: "custom" as const,
              }
            : undefined;
        const res = await transactionService.list({
          search: applied.search || undefined,
          range,
          page: 1,
          pageSize: 10000,
        });
        if (cancelled) return;
        setAllRows(res.all.filter((t) => matchesTab(t, tab)));
        setPage(1);
      } catch {
        if (!cancelled) toast.error("Failed to load reports");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applied, tab]);

  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return allRows.slice(start, start + pageSize);
  }, [allRows, page, pageSize]);

  const columns = useMemo(
    () =>
      [
        { accessorKey: "transactionId", header: "Transaction ID" },
        {
          accessorKey: "type",
          header: "Type",
          cell: ({ row }: { row: { original: Transaction } }) =>
            typeLabel(row.original.type),
        },
        {
          accessorKey: "amount",
          header: "Amount",
          cell: ({ row }: { row: { original: Transaction } }) =>
            formatINR(row.original.amount),
        },
        {
          accessorKey: "openingBalance",
          header: "Opening Balance",
          cell: ({ row }: { row: { original: Transaction } }) =>
            row.original.openingBalance != null
              ? formatINR(row.original.openingBalance)
              : "—",
        },
        {
          accessorKey: "closingBalance",
          header: "Closing Balance",
          cell: ({ row }: { row: { original: Transaction } }) =>
            row.original.closingBalance != null
              ? formatINR(row.original.closingBalance)
              : "—",
        },
        {
          accessorKey: "status",
          header: "Status",
          cell: ({ row }: { row: { original: Transaction } }) => (
            <Badge status={row.original.status} />
          ),
        },
        {
          accessorKey: "createdAt",
          header: "Date",
          cell: ({ row }: { row: { original: Transaction } }) =>
            format(new Date(row.original.createdAt), "dd MMM yyyy, HH:mm"),
        },
        {
          accessorKey: "reference",
          header: "Reference",
          cell: ({ row }: { row: { original: Transaction } }) =>
            row.original.reference || row.original.utr || "—",
        },
      ] as any,
    []
  );

  const onDownload = () => {
    const prefix = TABS.find((t) => t.id === tab)?.filePrefix || tab;
    downloadCSV(
      `${prefix}-report-${todayISO()}.csv`,
      [
        "Transaction ID",
        "Type",
        "Amount",
        "Opening Balance",
        "Closing Balance",
        "Status",
        "Date",
        "Reference",
      ],
      allRows.map((t) => [
        t.transactionId,
        typeLabel(t.type),
        t.amount,
        t.openingBalance ?? "",
        t.closingBalance ?? "",
        t.status,
        format(new Date(t.createdAt), "dd MMM yyyy HH:mm"),
        t.reference || t.utr || "",
      ])
    );
    toast.success("CSV downloaded");
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Reports</h1>
        <p className="mt-1 text-sm text-muted">Export and review transaction activity across products</p>
      </div>

      <Tabs
        tabs={TABS.map(({ id, label }) => ({ id, label }))}
        active={tab}
        onChange={(id) => {
          setLoading(true);
          setTab(id as ReportTab);
        }}
        className="mb-6"
      />

      <Card
        title={TABS.find((t) => t.id === tab)?.label}
        action={
          <Button variant="secondary" size="sm" onClick={onDownload}>
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
        }
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Search transaction ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-[10px] border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm focus:border-white/25 focus:outline-none focus:ring-2 focus:ring-white/10"
            />
          </div>
          <Input
            label="From"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="lg:w-44"
          />
          <Input
            label="To"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="lg:w-44"
          />
          <Button
            type="button"
            onClick={() => {
              setLoading(true);
              setApplied({ search, from, to });
            }}
          >
            Apply Filters
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={pageData}
          loading={loading}
          emptyTitle="There are no records to display"
          page={page}
          pageSize={pageSize}
          total={allRows.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </Card>
    </PageContainer>
  );
}
