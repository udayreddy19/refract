"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { payflowAdminApi, type PayflowDispute } from "@/lib/payflow-admin-api";
import { formatINR } from "@/lib/utils";

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<PayflowDispute[]>([]);
  const [agentId, setAgentId] = useState("");
  const [utr, setUtr] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await payflowAdminApi.disputes();
      setDisputes(res.disputes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load disputes");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      await payflowAdminApi.mutateDispute({
        action: "create",
        agentId,
        utr,
        amount: Number(amount) || 0,
        notes,
      });
      toast.success("Dispute opened");
      setUtr("");
      setAmount("");
      setNotes("");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell title="QR disputes">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card title="Open dispute">
          <div className="space-y-3">
            <Input label="Agent ID" value={agentId} onChange={(e) => setAgentId(e.target.value)} />
            <Input label="UTR" value={utr} onChange={(e) => setUtr(e.target.value)} />
            <Input
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button loading={busy} onClick={() => void create()}>
              Create dispute
            </Button>
          </div>
        </Card>
        <Card title="Queue">
          <div className="space-y-3">
            {disputes.map((d) => (
              <div
                key={d.id}
                className="rounded-[14px] border border-[var(--g-border)] p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono">{d.utr}</span>
                  <span className="capitalize text-[var(--t-mid)]">{d.status}</span>
                </div>
                <p className="mt-1 text-[var(--t-mid)]">
                  {d.agentId} · {formatINR(d.amount)}
                </p>
                <Select
                  className="mt-2"
                  value={d.status}
                  onChange={(e) => {
                    void payflowAdminApi
                      .mutateDispute({
                        action: "set_status",
                        id: d.id,
                        status: e.target.value,
                      })
                      .then(() => load())
                      .catch((err) =>
                        toast.error(err instanceof Error ? err.message : "Update failed")
                      );
                  }}
                  options={[
                    { value: "open", label: "Open" },
                    { value: "investigating", label: "Investigating" },
                    { value: "resolved", label: "Resolved" },
                    { value: "rejected", label: "Rejected" },
                  ]}
                />
              </div>
            ))}
            {disputes.length === 0 && (
              <p className="text-sm text-[var(--t-mid)]">No disputes yet.</p>
            )}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
