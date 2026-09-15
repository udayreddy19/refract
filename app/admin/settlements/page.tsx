"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { payflowAdminApi } from "@/lib/payflow-admin-api";
import { formatINR } from "@/lib/utils";

export default function AdminSettlementsPage() {
  const [settlements, setSettlements] = useState<
    Array<{
      id: string;
      uid: string;
      day: string;
      openingBalance: number;
      closingBalance: number;
      credits: number;
      debits: number;
    }>
  >([]);
  const [rules, setRules] = useState<
    Array<{
      product: string;
      feeFlat: number;
      feePct: number;
      marginFlat: number;
      marginPct: number;
    }>
  >([]);
  const [product, setProduct] = useState("bills");
  const [feeFlat, setFeeFlat] = useState("5");

  const load = useCallback(async () => {
    try {
      const res = await payflowAdminApi.settlements();
      setSettlements(res.settlements);
      setRules(res.commissionRules);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveRule = async () => {
    try {
      await payflowAdminApi.updateCommission({
        product,
        feeFlat: Number(feeFlat) || 0,
        feePct: 0,
        marginFlat: 0,
        marginPct: 0,
      });
      toast.success("Commission rule saved");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <AdminShell title="Settlements & commissions">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Commission rules">
          <div className="mb-4 space-y-2 text-sm">
            {rules.map((r) => (
              <div key={r.product} className="flex justify-between border-b border-[var(--g-border)] py-2">
                <span className="capitalize">{r.product}</span>
                <span>Fee ₹{r.feeFlat} + {r.feePct}%</span>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <Input label="Product (bills/qr/topup)" value={product} onChange={(e) => setProduct(e.target.value)} />
            <Input label="Flat fee (INR)" value={feeFlat} onChange={(e) => setFeeFlat(e.target.value)} />
            <Button onClick={() => void saveRule()}>Save rule</Button>
          </div>
        </Card>
        <Card title="Daily closing balances">
          <div className="space-y-2 text-sm">
            {settlements.length === 0 && (
              <p className="text-[var(--t-mid)]">
                Run nightly cron <code className="text-xs">/api/cron/payflow-backup.php</code> to
                populate.
              </p>
            )}
            {settlements.map((s) => (
              <div
                key={s.id}
                className="rounded-[12px] border border-[var(--g-border)] px-3 py-2"
              >
                <div className="flex justify-between font-medium">
                  <span>{s.day}</span>
                  <span>{formatINR(s.closingBalance)}</span>
                </div>
                <p className="text-xs text-[var(--t-low)]">
                  {s.uid} · in {formatINR(s.credits)} · out {formatINR(s.debits)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
