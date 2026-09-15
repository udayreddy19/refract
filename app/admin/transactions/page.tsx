"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import {
  payflowAdminApi,
  type PayflowLedgerEntry,
} from "@/lib/payflow-admin-api";
import { formatINR } from "@/lib/utils";

export default function AdminTransactionsPage() {
  const [entries, setEntries] = useState<PayflowLedgerEntry[]>([]);
  const [agentId, setAgentId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payflowAdminApi.ledger({
        agentId: agentId.trim().toUpperCase() || undefined,
        limit: 300,
      });
      setEntries(res.entries);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load ledger");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<ColumnDef<PayflowLedgerEntry>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "When",
        cell: ({ row }) => {
          const v = row.original.createdAt;
          try {
            return (
              <span className="text-sm text-[var(--t-mid)]">
                {format(new Date(v), "dd MMM yyyy, HH:mm")}
              </span>
            );
          } catch {
            return v;
          }
        },
      },
      {
        accessorKey: "agentId",
        header: "Retailer",
        cell: ({ row }) => (
          <div>
            <p className="font-mono text-sm">{row.original.agentId || row.original.uid}</p>
            {row.original.agentName && (
              <p className="text-xs text-[var(--t-low)]">{row.original.agentName}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <span className="text-sm capitalize">{row.original.type.replace(/_/g, " ")}</span>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => {
          const amt = row.original.amount;
          return (
            <span
              className={`font-mono ${amt >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}
            >
              {amt >= 0 ? "+" : ""}
              {formatINR(amt)}
            </span>
          );
        },
      },
      {
        accessorKey: "balance",
        header: "Balance after",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{formatINR(row.original.balance)}</span>
        ),
      },
      {
        accessorKey: "note",
        header: "Note",
        cell: ({ row }) => (
          <span className="text-sm text-[var(--t-mid)]">{row.original.note || "—"}</span>
        ),
      },
    ],
    []
  );

  return (
    <AdminShell title="Transactions">
      <div className="space-y-4">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Filter by Agent ID"
                placeholder="Agent ID"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value.toUpperCase())}
              />
            </div>
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </Card>

        <Card title={loading ? "Loading…" : `${entries.length} ledger entries`}>
          <DataTable columns={columns} data={entries} />
        </Card>
      </div>
    </AdminShell>
  );
}
