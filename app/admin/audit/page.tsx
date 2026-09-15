"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { payflowAdminApi, type PayflowAuditEntry } from "@/lib/payflow-admin-api";

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<PayflowAuditEntry[]>([]);
  const [mysql, setMysql] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payflowAdminApi.audit(200);
      setEntries(res.entries);
      setMysql(res.mysql);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const migrate = async () => {
    try {
      const res = await payflowAdminApi.migrate();
      toast.success(`Migrated: ${JSON.stringify(res.imported)}`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Migration failed");
    }
  };

  return (
    <AdminShell title="Audit log">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--t-mid)]">
          Storage: {mysql ? "MySQL (durable)" : "JSON fallback — configure MYSQL_* in secrets.php"}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
          <Button variant="secondary" onClick={() => void migrate()}>
            Import JSON → MySQL
          </Button>
        </div>
      </div>
      <Card title={loading ? "Loading…" : "Admin actions"}>
        <div className="space-y-3">
          {entries.length === 0 && (
            <p className="text-sm text-[var(--t-mid)]">No audit entries yet.</p>
          )}
          {entries.map((e) => (
            <div
              key={e.id}
              className="rounded-[14px] border border-[var(--g-border)] bg-[var(--input-bg)] px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-[var(--t-hi)]">{e.action}</span>
                <span className="text-xs text-[var(--t-low)]">{e.at}</span>
              </div>
              <p className="mt-1 text-[var(--t-mid)]">
                Role {e.actorRole || "admin"}
                {e.agentId ? ` · ${e.agentId}` : ""}
                {e.uid ? ` · ${e.uid}` : ""}
              </p>
              {(e.reason || e.receiptId) && (
                <p className="mt-1 text-xs text-[var(--t-low)]">
                  {e.reason ? `Reason: ${e.reason}` : ""}
                  {e.receiptId ? ` · Receipt: ${e.receiptId}` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </AdminShell>
  );
}
