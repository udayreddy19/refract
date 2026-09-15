"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  Building2,
  Car,
  CheckCircle2,
  CreditCard,
  Download,
  Droplets,
  Flame,
  GraduationCap,
  Heart,
  Home,
  Hospital,
  Landmark,
  Monitor,
  Phone,
  PiggyBank,
  Repeat,
  Shield,
  Smartphone,
  Tv,
  Users,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { BILL_CATEGORIES } from "@/lib/mock-data";
import { billPaymentService, transactionService } from "@/lib/services";
import type { BillCategory, BillDetails, Transaction } from "@/lib/types";
import { ReceiptActions } from "@/components/receipt/ReceiptActions";
import { formatINR, cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { type ColumnDef } from "@tanstack/react-table";
import { useEffect } from "react";

const iconMap: Record<string, LucideIcon> = {
  CreditCard,
  Zap,
  Car,
  Droplets,
  GraduationCap,
  Wifi,
  Shield,
  Phone,
  Smartphone,
  Tv,
  Building2,
  Heart,
  Monitor,
  Flame,
  Landmark,
  Repeat,
  Home,
  Hospital,
  PiggyBank,
  Users,
};

const formSchema = z.object({
  customerName: z.string().min(2, "Customer name is required"),
  consumerNumber: z.string().min(5, "Consumer number is required"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile"),
  billAmount: z.string().optional(),
  paymentAmount: z.string().min(1, "Payment amount is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function BillPaymentsPage() {
  const [tab, setTab] = useState("payments");
  const [selected, setSelected] = useState<BillCategory | null>(null);
  const [bill, setBill] = useState<BillDetails | null>(null);
  const [method, setMethod] = useState<"wallet" | "other">("wallet");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successTx, setSuccessTx] = useState<Transaction | null>(null);
  const [fetching, setFetching] = useState(false);
  const [paying, setPaying] = useState(false);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const walletBalance = useAppStore((s) => s.walletBalance);
  const setWalletBalance = useAppStore((s) => s.setWalletBalance);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "",
      consumerNumber: "",
      mobile: "",
      billAmount: "",
      paymentAmount: "",
    },
  });

  useEffect(() => {
    if (tab !== "history") return;
    setHistLoading(true);
    transactionService
      .list({ type: "bill", pageSize: 50 })
      .then((r) => setHistory(r.data))
      .finally(() => setHistLoading(false));
  }, [tab]);

  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      { accessorKey: "transactionId", header: "Transaction ID" },
      { accessorKey: "customerName", header: "Customer" },
      { accessorKey: "category", header: "Category" },
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
    ],
    []
  );

  const onFetch = async (values: FormValues) => {
    if (!selected) return;
    setFetching(true);
    try {
      const details = await billPaymentService.fetchBill({
        category: selected.name,
        customerName: values.customerName,
        consumerNumber: values.consumerNumber,
        mobile: values.mobile,
        paymentAmount: Number(values.paymentAmount),
      });
      setBill(details);
      toast.success("Bill fetched successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to fetch bill");
    } finally {
      setFetching(false);
    }
  };

  const onPay = async () => {
    if (!bill) return;
    setPaying(true);
    try {
      const tx = await billPaymentService.payBill(bill, method);
      if (method === "wallet") {
        setWalletBalance(walletBalance - bill.totalPayable);
      }
      if (selected) {
        void fetch("/api/payflow/favorites.php", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: selected.id,
            categoryName: selected.name,
            consumerNumber: bill.consumerNumber || bill.billNumber,
            customerName: bill.customerName,
            mobile: "",
            lastAmount: bill.totalPayable,
          }),
        }).catch(() => undefined);
      }
      setConfirmOpen(false);
      setSuccessTx(tx);
      toast.success("Payment successful");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const closeFlow = () => {
    setSelected(null);
    setBill(null);
    setSuccessTx(null);
    reset();
  };

  return (
    <PageContainer>
      <div className="wallet-banner mb-5 p-5">
        <div className="relative z-[1]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
            Recharge & Bills
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-white">
            Pay utility bills instantly
          </h1>
          <p className="mt-1 text-sm text-white/75">Service charge ₹5 · Wallet preferred</p>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "payments", label: "Bill Payments" },
          { id: "history", label: "Transactions History" },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-6"
      />

      {tab === "payments" && (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Select a category</h2>
              <p className="text-sm text-muted">Electricity, water, mobile & more</p>
            </div>
          </div>

          {!selected ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {BILL_CATEGORIES.map((cat) => {
                const Icon = iconMap[cat.icon] || CreditCard;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelected(cat)}
                    className="glass group flex flex-col items-center gap-3 rounded-[20px] p-4 text-center transition hover:-translate-y-0.5"
                  >
                    <span
                      className="relative z-[1] flex h-12 w-12 items-center justify-center rounded-[14px] transition group-hover:scale-105"
                      style={{ background: cat.bg, color: cat.color }}
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="relative z-[1] text-sm font-medium text-[var(--t-hi)]">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card
                title={`${selected.name} Payment`}
                action={
                  <Button variant="ghost" size="sm" onClick={closeFlow}>
                    Change category
                  </Button>
                }
              >
                <form onSubmit={handleSubmit(onFetch)} className="space-y-4">
                  <Input label="Customer Name" required error={errors.customerName?.message} {...register("customerName")} />
                  <Input label="Consumer Number" required error={errors.consumerNumber?.message} {...register("consumerNumber")} />
                  <Input label="Mobile Number" required error={errors.mobile?.message} {...register("mobile")} />
                  <Input label="Bill Amount" hint="Optional reference" {...register("billAmount")} />
                  <Input label="Payment Amount" required error={errors.paymentAmount?.message} {...register("paymentAmount")} />
                  <Button type="submit" loading={fetching} className="w-full">
                    {fetching ? "Fetching bill..." : "Fetch Bill"}
                  </Button>
                </form>
              </Card>

              {bill && (
                <Card title="Bill Details">
                  <dl className="space-y-3 text-sm">
                    {[
                      ["Customer Name", bill.customerName],
                      ["Bill Number", bill.billNumber],
                      ["Due Date", bill.dueDate],
                      ["Bill Amount", formatINR(bill.billAmount)],
                      ["Late Fee", formatINR(bill.lateFee)],
                      ["Total Payable", formatINR(bill.totalPayable)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 border-b border-border pb-2 last:border-0">
                        <dt className="text-muted">{k}</dt>
                        <dd className="font-medium text-foreground">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-5">
                    <p className="mb-2 text-sm font-medium text-foreground">Payment Method</p>
                    <div className="flex flex-col gap-2">
                      {[
                        { id: "wallet" as const, label: `Wallet (₹${walletBalance.toLocaleString("en-IN")})` },
                        { id: "other" as const, label: "Other available methods" },
                      ].map((m) => (
                    <label
                          key={m.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-[14px] border px-3 py-3 text-sm",
                            method === m.id
                              ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--t-hi)]"
                              : "border-[var(--g-border)] text-[var(--t-mid)]"
                          )}
                        >
                          <input
                            type="radio"
                            name="method"
                            checked={method === m.id}
                            onChange={() => setMethod(m.id)}
                          />
                          {m.label}
                        </label>
                      ))}
                    </div>
                    <Button className="mt-4 w-full" onClick={() => setConfirmOpen(true)}>
                      Pay Bill
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {tab === "history" && (
        <Card title="Bill Payment Transactions">
          <DataTable columns={columns} data={history} loading={histLoading} />
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onPay}
        loading={paying}
        title="Confirm Payment"
        description={`Pay ${formatINR(bill?.totalPayable || 0)} for ${bill?.customerName || "customer"} via ${method === "wallet" ? "Wallet" : "Other"}?`}
        confirmLabel={paying ? "Processing..." : "Confirm Pay"}
      />

      <Modal
        open={!!successTx}
        onClose={closeFlow}
        title="Payment Successful"
        size="sm"
      >
        {successTx && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <dl className="space-y-2 text-left text-sm">
              <div className="flex justify-between"><dt className="text-muted">Transaction ID</dt><dd className="font-medium">{successTx.transactionId}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Amount</dt><dd className="font-medium">{formatINR(successTx.amount)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Customer</dt><dd className="font-medium">{successTx.customerName}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Category</dt><dd className="font-medium">{successTx.category}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Date/time</dt><dd className="font-medium">{format(new Date(successTx.createdAt), "dd MMM yyyy, HH:mm")}</dd></div>
            </dl>
            <ReceiptActions
              receipt={{
                title: "Bill payment",
                status: "success",
                amount: successTx.amount,
                transactionId: successTx.transactionId,
                customer: successTx.customerName,
                category: successTx.category,
                at: format(new Date(successTx.createdAt), "dd MMM yyyy, HH:mm"),
              }}
            />
            <Button className="w-full" onClick={closeFlow}>
              Done
            </Button>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
