"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { RefreshCw, WalletCards } from "lucide-react";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { payflowAdminApi, type PayflowAgent } from "@/lib/payflow-admin-api";
import { formatINR } from "@/lib/utils";

export default function AdminWalletsPage() {
  const [wallets, setWallets] = useState<PayflowAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PayflowAgent | null>(null);
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("Admin adjustment");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payflowAdminApi.wallets();
      setWallets(res.wallets);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load wallets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = wallets.reduce((s, w) => s + (w.balance || 0), 0);

  const columns = useMemo<ColumnDef<PayflowAgent>[]>(
    () => [
      {
        accessorKey: "agentId",
        header: "Agent ID",
        cell: ({ row }) => <span className="font-mono">{row.original.agentId}</span>,
      },
      { accessorKey: "name", header: "Retailer" },
      {
        accessorKey: "balance",
        header: "Balance",
        cell: ({ row }) => (
          <span className="font-mono font-medium">{formatINR(row.original.balance || 0)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span className="text-sm capitalize text-[var(--t-mid)]">{row.original.status}</span>
        ),
      },
      {
        id: "actions",
        header: "Adjust",
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSelected(row.original);
              setAmount("");
              setDirection("credit");
              setNote("Admin adjustment");
            }}
          >
            <WalletCards className="h-3.5 w-3.5" />
            Adjust
          </Button>
        ),
      },
    ],
    []
  );

  const submit = async () => {
    if (!selected) return;
    const value = Number(amount);
    if (!(value > 0)) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      const res = await payflowAdminApi.adjustWallet({
        uid: selected.uid,
        direction,
        amount: value,
        note,
      });
      toast.success(`New balance ${formatINR(res.balance)}`);
      setSelected(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adjustment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell title="Wallets">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="glass rounded-[20px] p-4">
            <p className="relative z-[1] text-sm text-[var(--t-mid)]">Total float</p>
            <p className="relative z-[1] mt-2 font-display text-2xl font-semibold">
              {formatINR(total)}
            </p>
          </div>
          <div className="glass rounded-[20px] p-4">
            <p className="relative z-[1] text-sm text-[var(--t-mid)]">Retailer wallets</p>
            <p className="relative z-[1] mt-2 font-display text-2xl font-semibold">
              {wallets.length}
            </p>
          </div>
          <div className="glass flex items-center justify-end rounded-[20px] p-4">
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <Card title={loading ? "Loading…" : "Wallet balances"}>
          <DataTable columns={columns} data={wallets} />
        </Card>
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={`Adjust wallet · ${selected?.agentId || ""}`}
        description={`Current balance ${formatINR(selected?.balance || 0)}`}
      >
        <div className="space-y-3">
          <Select
            label="Direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value as "credit" | "debit")}
            options={[
              { value: "credit", label: "Credit (add funds)" },
              { value: "debit", label: "Debit (remove funds)" },
            ]}
          />
          <Input
            label="Amount (INR)"
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button className="w-full" loading={busy} onClick={() => void submit()}>
            Apply adjustment
          </Button>
        </div>
      </Modal>
    </AdminShell>
  );
}
