"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  CheckCircle2,
  Eye,
  GraduationCap,
  Landmark,
  Plane,
  RefreshCw,
  ShoppingBag,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import {
  CARD_TYPES,
  CATEGORY_TYPES,
  PAYMENT_CATEGORIES,
  QR_PRICING,
} from "@/lib/mock-data";
import { transactionService, walletService } from "@/lib/services";
import { paymentService } from "@/lib/services/paymentService";
import {
  openCashfreeCheckout,
  openRazorpayCheckout,
} from "@/lib/payments/gateways";
import type { BankAccount, Transaction } from "@/lib/types";
import { cn, formatINR, maskAccount } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

const categoryIconMap: Record<string, LucideIcon> = {
  ShoppingBag,
  GraduationCap,
  Plane,
};

const addFundsSchema = z.object({
  customerName: z.string().min(2, "Customer name is required"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile"),
  paymentCategory: z.string().min(1, "Payment category is required"),
  cardType: z.string().min(1, "Card type is required"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 100, {
      message: "Minimum amount is ₹100",
    }),
});

type AddFundsValues = z.infer<typeof addFundsSchema>;

const bankSchema = z
  .object({
    holderName: z.string().min(2, "Account holder name is required"),
    accountNumber: z
      .string()
      .min(9, "Account number must be at least 9 digits")
      .regex(/^\d+$/, "Account number must be numeric"),
    confirmAccountNumber: z.string().min(9, "Confirm account number"),
    ifsc: z
      .string()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, "Enter a valid IFSC code"),
    bankName: z.string().min(2, "Bank name is required"),
    fundType: z.enum(["Wallet", "Bank"], {
      required_error: "Fund type is required",
    }),
  })
  .refine((data) => data.accountNumber === data.confirmAccountNumber, {
    message: "Account numbers do not match",
    path: ["confirmAccountNumber"],
  });

type BankFormValues = z.infer<typeof bankSchema>;

export default function WalletPage() {
  const walletBalance = useAppStore((s) => s.walletBalance);
  const setWalletBalance = useAppStore((s) => s.setWalletBalance);

  const [mainTab, setMainTab] = useState("add");
  const [withdrawTab, setWithdrawTab] = useState("withdraw");
  const [refreshing, setRefreshing] = useState(false);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [gateway, setGateway] = useState<"RAZORPAY" | "CASHFREE">("RAZORPAY");
  const [demoMode, setDemoMode] = useState(true);
  const token = useAppStore((s) => s.token);
  const [addingFunds, setAddingFunds] = useState(false);

  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [addBankOpen, setAddBankOpen] = useState(false);
  const [verifyingBank, setVerifyingBank] = useState(false);
  const [bankVerified, setBankVerified] = useState(false);
  const [withdrawAmounts, setWithdrawAmounts] = useState<Record<string, string>>({});
  const [withdrawTarget, setWithdrawTarget] = useState<{
    bank: BankAccount;
    amount: number;
  } | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BankAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [history, setHistory] = useState<Transaction[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histPage, setHistPage] = useState(1);
  const [histTotal, setHistTotal] = useState(0);
  const histPageSize = 10;

  const {
    register: registerAdd,
    handleSubmit: handleAddSubmit,
    formState: { errors: addErrors },
    reset: resetAdd,
    setValue: setAddValue,
  } = useForm<AddFundsValues>({
    resolver: zodResolver(addFundsSchema),
    defaultValues: {
      customerName: "",
      mobile: "",
      paymentCategory: "",
      cardType: "",
      amount: "",
    },
  });

  const {
    register: registerBank,
    handleSubmit: handleBankSubmit,
    formState: { errors: bankErrors },
    reset: resetBank,
    watch: watchBank,
  } = useForm<BankFormValues>({
    resolver: zodResolver(bankSchema),
    defaultValues: {
      holderName: "",
      accountNumber: "",
      confirmAccountNumber: "",
      ifsc: "",
      bankName: "",
      fundType: "Wallet",
    },
  });

  const paymentOptions = useMemo(() => {
    if (!selectedCategory) return [];
    return (PAYMENT_CATEGORIES[selectedCategory] || []).map((c) => ({
      value: c,
      label: c,
    }));
  }, [selectedCategory]);

  const refreshBalance = useCallback(async () => {
    setRefreshing(true);
    try {
      const balance = await walletService.getBalance();
      setWalletBalance(balance);
      toast.success("Balance refreshed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to refresh balance");
    } finally {
      setRefreshing(false);
    }
  }, [setWalletBalance]);

  const loadBanks = useCallback(async () => {
    setBanksLoading(true);
    try {
      const list = await walletService.getBanks();
      setBanks(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load bank accounts");
    } finally {
      setBanksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === "withdraw" && withdrawTab === "withdraw") {
      loadBanks();
    }
  }, [mainTab, withdrawTab, loadBanks]);

  useEffect(() => {
    if (mainTab !== "withdraw" || withdrawTab !== "history") return;
    setHistLoading(true);
    transactionService
      .list({ type: "wallet_withdraw", page: histPage, pageSize: histPageSize })
      .then((r) => {
        setHistory(r.data);
        setHistTotal(r.total);
      })
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Failed to load history")
      )
      .finally(() => setHistLoading(false));
  }, [mainTab, withdrawTab, histPage]);

  const historyColumns = useMemo(
    () =>
      [
        { accessorKey: "transactionId", header: "Transaction ID" },
        {
          accessorKey: "bankAccount",
          header: "Bank Account",
          cell: ({ row }: { row: { original: Transaction } }) =>
            row.original.bankAccount || "—",
        },
        {
          accessorKey: "amount",
          header: "Amount",
          cell: ({ row }: { row: { original: Transaction } }) =>
            formatINR(row.original.amount),
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
          accessorKey: "utr",
          header: "UTR",
          cell: ({ row }: { row: { original: Transaction } }) =>
            row.original.utr || "—",
        },
        {
          id: "action",
          header: "Action",
          cell: ({ row }: { row: { original: Transaction } }) => (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                toast.message("Withdrawal details", {
                  description: `${row.original.transactionId} · ${formatINR(row.original.amount)}${row.original.utr ? ` · ${row.original.utr}` : ""}`,
                })
              }
            >
              <Eye className="h-4 w-4" />
              View
            </Button>
          ),
        },
      ] as never,
    []
  );

  useEffect(() => {
    paymentService.getProviders().then((p) => {
      setDemoMode(p.demoMode);
      const enabled = p.providers.find((x) => x.enabled)?.id;
      setGateway(p.primary || enabled || "RAZORPAY");
    });
  }, []);

  const openCategoryModal = () => {
    setPendingCategory(selectedCategory);
    setCategoryModalOpen(true);
  };

  const confirmCategory = () => {
    if (!pendingCategory) {
      toast.error("Please select a category type");
      return;
    }
    setSelectedCategory(pendingCategory);
    setAddValue("paymentCategory", "");
    setCategoryModalOpen(false);
  };

  const onAddFunds = async (values: AddFundsValues) => {
    if (!selectedCategory) {
      toast.error("Select a category type first");
      return;
    }
    const amount = Number(values.amount);
    if (Number.isNaN(amount) || amount < 100) {
      toast.error("Minimum top-up is ₹100");
      return;
    }
    setAddingFunds(true);
    try {
      const order = await paymentService.createOrder({
        amount,
        provider: gateway,
        customerName: values.customerName,
        mobile: values.mobile,
        category: values.paymentCategory,
        idToken: token || undefined,
      });

      if (order.demoMode) {
        const verified = await paymentService.verify({
          provider: gateway,
          depositId: order.depositId,
          orderId: order.orderId,
          razorpay_payment_id: `pay_demo_${Date.now()}`,
          razorpay_signature: "demo",
          idToken: token || undefined,
        });
        setWalletBalance(verified.balance);
        resetAdd();
        toast.success("Demo payment credited to wallet");
        return;
      }

      if (gateway === "RAZORPAY") {
        const rzp = await openRazorpayCheckout({
          keyId: order.keyId || "",
          orderId: order.orderId,
          amountPaise: order.amountPaise,
          name: values.customerName,
          mobile: values.mobile,
          description: `Wallet top-up · ${values.paymentCategory}`,
        });
        const verified = await paymentService.verify({
          provider: "RAZORPAY",
          depositId: order.depositId,
          orderId: order.orderId,
          razorpay_payment_id: rzp.razorpay_payment_id,
          razorpay_signature: rzp.razorpay_signature,
          idToken: token || undefined,
        });
        setWalletBalance(verified.balance);
        resetAdd();
        toast.success("Razorpay payment successful");
        return;
      }

      // Cashfree
      if (!order.paymentSessionId) {
        throw new Error("Cashfree payment session missing");
      }
      await openCashfreeCheckout({
        paymentSessionId: order.paymentSessionId,
        environment: order.environment,
      });
      const verified = await paymentService.verify({
        provider: "CASHFREE",
        depositId: order.depositId,
        orderId: order.orderId,
        idToken: token || undefined,
      });
      setWalletBalance(verified.balance);
      resetAdd();
      toast.success("Cashfree payment successful");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setAddingFunds(false);
    }
  };

  const onVerifyBank = async (values: BankFormValues) => {
    setVerifyingBank(true);
    try {
      await walletService.verifyBank({
        holderName: values.holderName,
        accountNumber: values.accountNumber,
        ifsc: values.ifsc.toUpperCase(),
        bankName: values.bankName,
        fundType: values.fundType,
      });
      setBankVerified(true);
      toast.success("Bank account verified");
      await loadBanks();
      setTimeout(() => {
        setAddBankOpen(false);
        resetBank();
        setBankVerified(false);
      }, 800);
    } catch (e) {
      setBankVerified(false);
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifyingBank(false);
    }
  };

  const requestWithdraw = (bank: BankAccount) => {
    const raw = withdrawAmounts[bank.id] || "";
    const amount = Number(raw);
    if (!raw || Number.isNaN(amount) || amount < 100) {
      toast.error("Enter a valid amount (minimum ₹100)");
      return;
    }
    if (amount > walletBalance) {
      toast.error("Insufficient wallet balance");
      return;
    }
    setWithdrawTarget({ bank, amount });
  };

  const confirmWithdraw = async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    try {
      const result = await walletService.withdraw(
        withdrawTarget.bank.id,
        withdrawTarget.amount
      );
      setWalletBalance(result.balance);
      setWithdrawAmounts((prev) => ({ ...prev, [withdrawTarget.bank.id]: "" }));
      setWithdrawTarget(null);
      toast.success("Withdrawal submitted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Withdrawal failed");
    } finally {
      setWithdrawing(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await walletService.deleteBank(deleteTarget.id);
      setBanks((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Bank account deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  const selectedCategoryMeta = CATEGORY_TYPES.find((c) => c.id === selectedCategory);

  return (
    <PageContainer>
      <div className="wallet-banner mb-6 p-5 sm:p-6">
        <div className="relative z-[1] flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
              Funds Wallet
            </p>
            <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {formatINR(walletBalance)}
            </p>
            <p className="mt-1 text-sm text-white/75">Available to spend & withdraw</p>
          </div>
          <Button
            className="!border-white/30 !bg-white/15 !text-white hover:!bg-white/25"
            size="icon"
            onClick={refreshBalance}
            loading={refreshing}
            aria-label="Refresh balance"
          >
            {!refreshing && <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "add", label: "Add Funds" },
          { id: "withdraw", label: "Withdraw Funds" },
        ]}
        active={mainTab}
        onChange={setMainTab}
        className="mb-6"
      />

      {mainTab === "add" && (
        <div className="space-y-5">
          {!selectedCategory ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
              <Card title="Prices">
                <dl className="space-y-3 text-sm">
                  {[
                    ["Plan", QR_PRICING.name],
                    ["Domestic", QR_PRICING.domestic],
                    ["Business Limit", QR_PRICING.business],
                    ["Card Limits", QR_PRICING.cardLimits],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between gap-4 border-b border-border pb-2 last:border-0"
                    >
                      <dt className="text-muted">{k}</dt>
                      <dd className="font-medium text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Card>

              <Card>
                <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 text-center">
                  <p className="text-sm text-muted">
                    Choose a category type to start adding funds to your wallet.
                  </p>
                  <Button onClick={openCategoryModal}>SELECT CATEGORY TYPE</Button>
                </div>
              </Card>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
              <Card title="Prices">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted">Category</dt>
                    <dd className="font-medium text-foreground">
                      {selectedCategoryMeta?.name}
                    </dd>
                  </div>
                  {[
                    ["Domestic", QR_PRICING.domestic],
                    ["Business Limit", QR_PRICING.business],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between gap-4 border-b border-border pb-2 last:border-0"
                    >
                      <dt className="text-muted">{k}</dt>
                      <dd className="font-medium text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Card>

              <Card
                title="Add Funds"
                action={
                  <Badge className="bg-primary-light text-[var(--t-hi)]">
                    {selectedCategoryMeta?.name}
                  </Badge>
                }
              >
                <form onSubmit={handleAddSubmit(onAddFunds)} className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[var(--t-mid)]">Payment Gateway</p>
                    <div className="flex flex-wrap gap-2">
                      {(["RAZORPAY", "CASHFREE"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGateway(g)}
                          className={cn(
                            "rounded-full border px-4 py-2 text-sm font-medium transition",
                            gateway === g
                              ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                              : "border-[var(--g-border)] bg-[var(--input-bg)] text-[var(--t-mid)] hover:text-[var(--t-hi)]"
                          )}
                        >
                          {g === "RAZORPAY" ? "Razorpay" : "Cashfree"}
                        </button>
                      ))}
                    </div>
                    {demoMode && (
                      <p className="text-xs text-[var(--yellow)]">
                        Gateway keys not configured — payments run in demo mode.
                      </p>
                    )}
                  </div>
                  <Input
                    label="Customer Name"
                    required
                    error={addErrors.customerName?.message}
                    {...registerAdd("customerName")}
                  />
                  <Input
                    label="Mobile"
                    required
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit mobile"
                    error={addErrors.mobile?.message}
                    {...registerAdd("mobile")}
                  />
                  <Select
                    label="Payment Category"
                    required
                    placeholder="Select payment category"
                    options={paymentOptions}
                    error={addErrors.paymentCategory?.message}
                    {...registerAdd("paymentCategory")}
                  />
                  <Select
                    label="Card Type"
                    required
                    placeholder="Select card type"
                    options={CARD_TYPES.map((c) => ({ value: c, label: c }))}
                    error={addErrors.cardType?.message}
                    {...registerAdd("cardType")}
                  />
                  <Input
                    label="Amount"
                    required
                    type="number"
                    min={100}
                    step="0.01"
                    placeholder="Minimum ₹100"
                    error={addErrors.amount?.message}
                    {...registerAdd("amount")}
                  />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      onClick={openCategoryModal}
                    >
                      Select Category Type
                    </Button>
                    <Button type="submit" className="flex-1" loading={addingFunds}>
                      {addingFunds
                        ? "Processing..."
                        : `Pay with ${gateway === "RAZORPAY" ? "Razorpay" : "Cashfree"}`}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}
        </div>
      )}

      {mainTab === "withdraw" && (
        <div className="space-y-5">
          <Tabs
            tabs={[
              { id: "withdraw", label: "Withdraw" },
              { id: "history", label: "History" },
            ]}
            active={withdrawTab}
            onChange={(id) => {
              setWithdrawTab(id);
              if (id === "history") setHistPage(1);
            }}
          />

          {withdrawTab === "withdraw" && (
            <div className="space-y-5">
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      Add New Account
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      Link a verified bank account to withdraw funds.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      resetBank();
                      setBankVerified(false);
                      setAddBankOpen(true);
                    }}
                  >
                    <Landmark className="h-4 w-4" />
                    Add Bank
                  </Button>
                </div>
              </Card>

              <div>
                <h3 className="mb-3 text-base font-semibold text-foreground">
                  Saved Bank Accounts
                </h3>
                {banksLoading ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-48 animate-pulse rounded-xl border border-border bg-card"
                      />
                    ))}
                  </div>
                ) : banks.length === 0 ? (
                  <Card>
                    <EmptyState
                      title="No bank accounts saved"
                      description="Add a bank account to start withdrawing funds."
                    />
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {banks.map((bank) => (
                      <Card key={bank.id} className="relative">
                        <button
                          type="button"
                          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted hover:bg-danger-bg hover:text-danger"
                          aria-label={`Delete ${bank.bankName} account`}
                          onClick={() => setDeleteTarget(bank)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="pr-8">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">
                              {bank.holderName}
                            </p>
                            {bank.verified && (
                              <Badge className="bg-success-bg text-success">
                                Verified
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted">{bank.bankName}</p>
                          <dl className="mt-3 space-y-1.5 text-sm">
                            <div className="flex justify-between gap-2">
                              <dt className="text-muted">A/C</dt>
                              <dd className="font-medium">
                                {maskAccount(bank.accountNumber)}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-muted">IFSC</dt>
                              <dd className="font-medium">{bank.ifsc}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt className="text-muted">Fund Type</dt>
                              <dd className="font-medium">{bank.fundType}</dd>
                            </div>
                          </dl>
                        </div>
                        <div className="mt-4 space-y-3 border-t border-border pt-4">
                          <Input
                            label="Amount"
                            type="number"
                            min={100}
                            step="0.01"
                            placeholder="Enter amount"
                            value={withdrawAmounts[bank.id] || ""}
                            onChange={(e) =>
                              setWithdrawAmounts((prev) => ({
                                ...prev,
                                [bank.id]: e.target.value,
                              }))
                            }
                          />
                          <Button
                            className="w-full"
                            disabled={!bank.verified}
                            onClick={() => requestWithdraw(bank)}
                          >
                            Transfer
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {withdrawTab === "history" && (
            <Card title="Withdrawal History">
              <DataTable
                columns={historyColumns}
                data={history}
                loading={histLoading}
                emptyTitle="No withdrawal transactions"
                page={histPage}
                pageSize={histPageSize}
                total={histTotal}
                onPageChange={setHistPage}
              />
            </Card>
          )}
        </div>
      )}

      <Modal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title="Select Category Type"
        description="We found 3 category types. Select one to continue adding funds."
        size="md"
      >
        <div className="space-y-3">
          {CATEGORY_TYPES.map((cat) => {
            const Icon = categoryIconMap[cat.icon] || ShoppingBag;
            const active = pendingCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setPendingCategory(cat.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition",
                  active
                    ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                    : "border-[var(--g-border)] bg-[var(--input-bg)] hover:border-[var(--brand)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    active
                      ? "bg-[var(--brand)] text-white"
                      : "bg-[var(--surface)] text-[var(--t-hi)]"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    {cat.name}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {cat.description}
                  </span>
                </span>
                {active && (
                  <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-[var(--t-hi)]" />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setCategoryModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={confirmCategory} disabled={!pendingCategory}>
            Continue
          </Button>
        </div>
      </Modal>

      <Modal
        open={addBankOpen}
        onClose={() => {
          if (verifyingBank) return;
          setAddBankOpen(false);
          setBankVerified(false);
        }}
        title="Add Bank"
        description="Enter account details and verify before saving."
        size="md"
      >
        <form onSubmit={handleBankSubmit(onVerifyBank)} className="space-y-4">
          <Input
            label="Account Holder Name"
            required
            error={bankErrors.holderName?.message}
            {...registerBank("holderName")}
          />
          <Input
            label="Account Number"
            required
            inputMode="numeric"
            error={bankErrors.accountNumber?.message}
            {...registerBank("accountNumber")}
          />
          <Input
            label="Confirm Account Number"
            required
            inputMode="numeric"
            error={bankErrors.confirmAccountNumber?.message}
            {...registerBank("confirmAccountNumber")}
          />
          <Input
            label="IFSC"
            required
            placeholder="e.g. HDFC0001234"
            error={bankErrors.ifsc?.message}
            {...registerBank("ifsc")}
          />
          <Input
            label="Bank Name"
            required
            error={bankErrors.bankName?.message}
            {...registerBank("bankName")}
          />
          <Select
            label="Fund Type"
            required
            options={[
              { value: "Wallet", label: "Wallet" },
              { value: "Bank", label: "Bank" },
            ]}
            error={bankErrors.fundType?.message}
            {...registerBank("fundType")}
          />
          {bankVerified && (
            <div className="flex items-center gap-2 rounded-[10px] bg-success-bg px-3 py-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              Verified
            </div>
          )}
          <Button type="submit" className="w-full" loading={verifyingBank}>
            {verifyingBank ? "Verifying..." : "Verify Account"}
          </Button>
          {watchBank("accountNumber") &&
            watchBank("confirmAccountNumber") &&
            watchBank("accountNumber") !== watchBank("confirmAccountNumber") && (
              <p className="text-xs text-danger">Account numbers do not match</p>
            )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!withdrawTarget}
        onClose={() => setWithdrawTarget(null)}
        onConfirm={confirmWithdraw}
        loading={withdrawing}
        title="Confirm Withdrawal"
        description={`Confirm withdrawal of ${formatINR(withdrawTarget?.amount || 0)} to account ending ${withdrawTarget?.bank.accountNumber.slice(-4) ?? "XXXX"}?`}
        confirmLabel={withdrawing ? "Processing..." : "Confirm Transfer"}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        variant="danger"
        title="Delete Bank Account"
        description={`Remove account ending ${deleteTarget?.accountNumber.slice(-4) ?? "XXXX"} (${deleteTarget?.bankName ?? "bank"})? This cannot be undone.`}
        confirmLabel={deleting ? "Deleting..." : "Delete"}
      />
    </PageContainer>
  );
}
