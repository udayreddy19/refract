"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, RefreshCw, Ban, CheckCircle2, KeyRound, Pencil } from "lucide-react";
import { toast } from "sonner";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  payflowAdminApi,
  type PayflowAgent,
} from "@/lib/payflow-admin-api";
import { formatINR } from "@/lib/utils";

type FormState = {
  agentId: string;
  name: string;
  email: string;
  mobile: string;
  passcode: string;
  city: string;
  notes: string;
};

const emptyForm: FormState = {
  agentId: "",
  name: "",
  email: "",
  mobile: "",
  passcode: "",
  city: "",
  notes: "",
};

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<PayflowAgent[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<PayflowAgent | null>(null);
  const [passAgent, setPassAgent] = useState<PayflowAgent | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newPass, setNewPass] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payflowAdminApi.agents(q, status);
      setAgents(res.agents);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load retailers");
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<ColumnDef<PayflowAgent>[]>(
    () => [
      {
        accessorKey: "agentId",
        header: "Agent ID",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.agentId}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "Retailer",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-[var(--t-low)]">{row.original.email}</p>
          </div>
        ),
      },
      {
        accessorKey: "mobile",
        header: "Mobile",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.mobile || "—"}</span>
        ),
      },
      {
        accessorKey: "balance",
        header: "Wallet",
        cell: ({ row }) => (
          <span className="font-mono">{formatINR(row.original.balance || 0)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            className={
              row.original.status === "disabled"
                ? "bg-[var(--red-bg)] text-[var(--red)] border-[var(--red-border)]"
                : "bg-[var(--green-bg)] text-[var(--green)] border-[var(--green-border)]"
            }
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const a = row.original;
          const disabled = a.status === "disabled";
          return (
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditAgent(a);
                  setForm({
                    agentId: a.agentId,
                    name: a.name,
                    email: a.email,
                    mobile: a.mobile,
                    passcode: "",
                    city: a.city || "",
                    notes: a.notes || "",
                  });
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPassAgent(a);
                  setNewPass("");
                }}
              >
                <KeyRound className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant={disabled ? "success" : "danger"}
                onClick={async () => {
                  try {
                    await payflowAdminApi.mutateAgent({
                      action: "set_status",
                      uid: a.uid,
                      status: disabled ? "active" : "disabled",
                    });
                    toast.success(disabled ? "Retailer enabled" : "Retailer suspended");
                    void load();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Update failed");
                  }
                }}
              >
                {disabled ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Ban className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          );
        },
      },
    ],
    [load]
  );

  const createAgent = async () => {
    setBusy(true);
    try {
      await payflowAdminApi.mutateAgent({
        action: "create",
        ...form,
        agentId: form.agentId.trim().toUpperCase(),
      });
      toast.success("Retailer created");
      setCreateOpen(false);
      setForm(emptyForm);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editAgent) return;
    setBusy(true);
    try {
      await payflowAdminApi.mutateAgent({
        action: "update",
        uid: editAgent.uid,
        name: form.name,
        email: form.email,
        mobile: form.mobile,
        city: form.city,
        notes: form.notes,
      });
      toast.success("Retailer updated");
      setEditAgent(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const resetPass = async () => {
    if (!passAgent) return;
    setBusy(true);
    try {
      await payflowAdminApi.mutateAgent({
        action: "reset_passcode",
        uid: passAgent.uid,
        passcode: newPass,
      });
      toast.success("Passcode reset");
      setPassAgent(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell title="Retailers">
      <div className="space-y-4">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Search"
                placeholder="Agent ID, name, mobile, email"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-44">
              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={[
                  { value: "", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "disabled", label: "Disabled" },
                ]}
              />
            </div>
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              onClick={() => {
                setForm(emptyForm);
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add retailer
            </Button>
          </div>
        </Card>

        <Card title={loading ? "Loading…" : `${agents.length} retailers`}>
          <DataTable columns={columns} data={agents} />
        </Card>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add retailer"
        description="Creates an Agent ID that can sign in to the retailer portal."
      >
        <div className="space-y-3">
          <Input
            label="Agent ID"
            placeholder="AGENT2001"
            value={form.agentId}
            onChange={(e) => setForm({ ...form, agentId: e.target.value.toUpperCase() })}
          />
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Mobile"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          />
          <Input
            label="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Passcode"
            type="password"
            value={form.passcode}
            onChange={(e) => setForm({ ...form, passcode: e.target.value })}
          />
          <Input
            label="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          <Input
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <Button className="w-full" loading={busy} onClick={() => void createAgent()}>
            Create retailer
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(editAgent)}
        onClose={() => setEditAgent(null)}
        title={`Edit ${editAgent?.agentId || ""}`}
      >
        <div className="space-y-3">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Mobile"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          />
          <Input
            label="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          <Input
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <Button className="w-full" loading={busy} onClick={() => void saveEdit()}>
            Save changes
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(passAgent)}
        onClose={() => setPassAgent(null)}
        title={`Reset passcode · ${passAgent?.agentId || ""}`}
      >
        <div className="space-y-3">
          <Input
            label="New passcode"
            type="password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
          />
          <Button className="w-full" loading={busy} onClick={() => void resetPass()}>
            Reset passcode
          </Button>
        </div>
      </Modal>
    </AdminShell>
  );
}
