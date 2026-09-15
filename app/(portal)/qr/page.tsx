"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CheckCircle2, Download, Eye, Filter, QrCode, Search } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { FileUpload } from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { QR_PRICING } from "@/lib/mock-data";
import { qrService } from "@/lib/services";
import type { Transaction } from "@/lib/types";
import { downloadCSV, formatINR, todayISO } from "@/lib/utils";

const formSchema = z.object({
  customerName: z.string().min(2, "Customer name is required"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile"),
  email: z.string().email("Enter a valid email"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => {
      const n = Number(v);
      return !Number.isNaN(n) && n >= 100 && n <= 100000;
    }, "Amount must be between ₹100 and ₹1,00,000"),
  utr: z.string().min(8, "UTR is required"),
  receipt: z.custom<File | null>((v) => v instanceof File, {
    message: "Receipt image is required",
  }),
});

type FormValues = z.infer<typeof formSchema>;

const QR_PAYLOAD = "upi://pay?pa=unisuspe@payflow&pn=UNISUSPE&cu=INR";

export default function QRCollectionPage() {
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ search: "", from: "", to: "" });
  const [pendingTx, setPendingTx] = useState<Transaction | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<Transaction | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "",
      mobile: "",
      email: "",
      amount: "",
      utr: "",
      receipt: null,
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await qrService.history({
          search: applied.search || undefined,
          from: applied.from || undefined,
          to: applied.to || undefined,
        });
        if (!cancelled) setHistory(data);
      } catch {
        if (!cancelled) toast.error("Failed to load QR history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applied]);

  const refreshHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await qrService.history({
        search: applied.search || undefined,
        from: applied.from || undefined,
        to: applied.to || undefined,
      });
      setHistory(data);
    } catch {
      toast.error("Failed to load QR history");
    } finally {
      setLoading(false);
    }
  }, [applied]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const tx = await qrService.submitPending({
        customerName: values.customerName,
        mobile: values.mobile,
        email: values.email,
        amount: Number(values.amount),
        utr: values.utr,
        receiptName: values.receipt!.name,
      });
      toast.success("QR payment submitted for verification");
      setPendingTx(tx);
      reset();
      await refreshHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onDownload = () => {
    downloadCSV(
      `qr-report-${todayISO()}.csv`,
      ["Transaction ID", "Customer", "Mobile", "Amount", "UTR", "Status", "Receipt", "Date"],
      history.map((t) => [
        t.transactionId,
        t.customerName,
        t.mobile,
        t.amount,
        t.utr ?? "",
        t.status,
        t.receiptName ?? "",
        format(new Date(t.createdAt), "dd MMM yyyy HH:mm"),
      ])
    );
    toast.success("CSV downloaded");
  };

  const columns = useMemo(
    () =>
      [
        { accessorKey: "transactionId", header: "Transaction ID" },
        { accessorKey: "customerName", header: "Customer" },
        { accessorKey: "mobile", header: "Mobile" },
        {
          accessorKey: "amount",
          header: "Amount",
          cell: ({ row }: { row: { original: Transaction } }) =>
            formatINR(row.original.amount),
        },
        {
          accessorKey: "utr",
          header: "UTR",
          cell: ({ row }: { row: { original: Transaction } }) =>
            row.original.utr || "—",
        },
        {
          accessorKey: "status",
          header: "Status",
          cell: ({ row }: { row: { original: Transaction } }) => (
            <Badge status={row.original.status} />
          ),
        },
        {
          accessorKey: "receiptName",
          header: "Receipt",
          cell: ({ row }: { row: { original: Transaction } }) =>
            row.original.receiptName || "—",
        },
        {
          accessorKey: "createdAt",
          header: "Date",
          cell: ({ row }: { row: { original: Transaction } }) =>
            format(new Date(row.original.createdAt), "dd MMM yyyy, HH:mm"),
        },
        {
          id: "action",
          header: "Action",
          cell: ({ row }: { row: { original: Transaction } }) => (
            <Button
              size="sm"
              variant="ghost"
              aria-label="View receipt"
              onClick={() => setReceiptPreview(row.original)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          ),
        },
      ] as any,
    []
  );

  return (
    <PageContainer>
      <div className="wallet-banner mb-6 p-5">
        <div className="relative z-[1]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
            Scan & Pay
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-white">QR Collection</h1>
          <p className="mt-1 text-sm text-white/75">
            Collect via Unisuspe QR and upload pending receipts
          </p>
        </div>
      </div>

      <Card className="mb-6" title="QR Pricing">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["UNISUSPE", QR_PRICING.name],
            ["Domestic", QR_PRICING.domestic],
            ["Business", QR_PRICING.business],
            ["Card Limits", QR_PRICING.cardLimits],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[10px] border border-border bg-background px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      {!QR_PRICING.enabled && (
        <div
          className="mb-6 rounded-[10px] border border-warning/40 bg-warning-bg px-4 py-3 text-sm text-warning"
          role="alert"
        >
          <p className="font-semibold">QR is currently disabled</p>
          <p className="mt-1 opacity-90">
            Live QR is hidden while inactive. You can still upload pending receipts with UTR details for verification.
          </p>
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-4 text-base font-semibold text-foreground">Pay via QR — Unisuspe</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="QR Display">
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[10px] border border-dashed border-border bg-background p-6">
              {QR_PRICING.enabled ? (
                <>
                  <QRCodeSVG value={QR_PAYLOAD} size={200} level="M" includeMargin />
                  <p className="mt-4 text-sm font-medium text-foreground">{QR_PRICING.name}</p>
                  <p className="text-xs text-muted">Scan to pay</p>
                </>
              ) : (
                <>
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-[var(--g-border)] bg-[var(--surface)]">
                    <QrCode className="h-12 w-12 text-muted opacity-40" />
                  </div>
                  <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-muted">QR Disabled</p>
                  <p className="mt-1 max-w-xs text-center text-xs text-muted">
                    Dynamic QR is unavailable. Submit UTR and receipt below for pending collection.
                  </p>
                </>
              )}
            </div>
          </Card>

          <Card title="Payment Details">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Customer Name"
                required
                error={errors.customerName?.message}
                {...register("customerName")}
              />
              <Input
                label="Mobile"
                required
                inputMode="numeric"
                maxLength={10}
                error={errors.mobile?.message}
                {...register("mobile")}
              />
              <Input
                label="Email"
                type="email"
                required
                error={errors.email?.message}
                {...register("email")}
              />
              <Input
                label="Amount"
                required
                inputMode="decimal"
                hint="₹100 – ₹1,00,000"
                error={errors.amount?.message}
                {...register("amount")}
              />
              <Input label="UTR" required error={errors.utr?.message} {...register("utr")} />
              <Controller
                name="receipt"
                control={control}
                render={({ field }) => (
                  <FileUpload
                    label="Receipt Image"
                    required
                    value={field.value}
                    error={errors.receipt?.message}
                    onChange={field.onChange}
                  />
                )}
              />
              <Button type="submit" loading={submitting} className="w-full">
                {submitting ? "Submitting..." : "Submit Pending Payment"}
              </Button>
            </form>
          </Card>
        </div>
      </section>

      <Card
        title="History List"
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
              placeholder="Search transaction, customer, mobile, UTR"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-[10px] border border-[var(--g-border)] bg-[var(--input-bg)] pl-10 pr-3 text-sm text-[var(--t-hi)] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-soft)]"
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
            variant="secondary"
            onClick={() => {
              setLoading(true);
              setApplied({ search, from, to });
            }}
          >
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={history}
          loading={loading}
          emptyTitle="There are no records to display"
        />
      </Card>

      <Modal
        open={!!pendingTx}
        onClose={() => setPendingTx(null)}
        title="Pending Confirmation"
        size="sm"
      >
        {pendingTx && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-warning" />
            <p className="text-sm text-muted">
              Your QR collection has been submitted and is awaiting verification.
            </p>
            <dl className="space-y-2 text-left text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Transaction ID</dt>
                <dd className="font-medium">{pendingTx.transactionId}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Customer</dt>
                <dd className="font-medium">{pendingTx.customerName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Amount</dt>
                <dd className="font-medium">{formatINR(pendingTx.amount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">UTR</dt>
                <dd className="font-medium">{pendingTx.utr}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Status</dt>
                <dd>
                  <Badge status={pendingTx.status} />
                </dd>
              </div>
            </dl>
            <Button className="w-full" onClick={() => setPendingTx(null)}>
              Done
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        open={!!receiptPreview}
        onClose={() => setReceiptPreview(null)}
        title="Receipt Preview"
        size="md"
      >
        {receiptPreview && (
          <div className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Transaction ID</dt>
                <dd className="font-medium">{receiptPreview.transactionId}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Customer</dt>
                <dd className="font-medium">{receiptPreview.customerName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Amount</dt>
                <dd className="font-medium">{formatINR(receiptPreview.amount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">UTR</dt>
                <dd className="font-medium">{receiptPreview.utr || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Receipt</dt>
                <dd className="font-medium">{receiptPreview.receiptName || "—"}</dd>
              </div>
            </dl>
            <div className="flex h-48 items-center justify-center rounded-[10px] border border-dashed border-border bg-background text-sm text-muted">
              {receiptPreview.receiptName
                ? `Preview: ${receiptPreview.receiptName}`
                : "No receipt attached"}
            </div>
            <Button className="w-full" variant="secondary" onClick={() => setReceiptPreview(null)}>
              Close
            </Button>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
