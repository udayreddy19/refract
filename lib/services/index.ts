import { isWithinInterval, startOfDay, endOfDay, subDays } from "date-fns";
import {
  CURRENT_USER,
  MOCK_BANK_ACCOUNTS,
  MOCK_CREDENTIALS,
  MOCK_TRANSACTIONS,
  MOCK_WALLET_BALANCE,
  getChartData,
  mutateBalance,
  mutateBanks,
  mutateTransactions,
} from "@/lib/mock-data";
import type {
  BankAccount,
  BillDetails,
  DashboardStats,
  DateRange,
  Transaction,
  TransactionStatus,
  TransactionType,
} from "@/lib/types";
import { delay } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

/** Swap implementations to hit real APIs when NEXT_PUBLIC_API_URL is set */
async function apiFetch<T>(_path: string, _init?: RequestInit): Promise<T | null> {
  if (!API_BASE) return null;
  // Placeholder for future backend integration
  return null;
}

export const authService = {
  async login(agentId: string, passcode: string): Promise<{ token: string; user: typeof CURRENT_USER }> {
    await delay(900);
    const remote = await apiFetch<{ token: string; user: typeof CURRENT_USER }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ agentId, passcode }),
    });
    if (remote) return remote;
    if (
      agentId.trim().toUpperCase() === MOCK_CREDENTIALS.agentId &&
      passcode === MOCK_CREDENTIALS.passcode
    ) {
      return { token: "mock-jwt-token", user: CURRENT_USER };
    }
    throw new Error("Invalid Agent ID or Passcode");
  },
  async changePasscode(current: string, next: string) {
    await delay(800);
    if (current !== MOCK_CREDENTIALS.passcode) {
      throw new Error("Current passcode is incorrect");
    }
    if (next.length < 6) throw new Error("New passcode must be at least 6 digits");
    return { success: true };
  },
};

function inRange(dateStr: string, range?: DateRange) {
  if (!range) return true;
  const d = new Date(dateStr);
  return isWithinInterval(d, {
    start: startOfDay(range.from),
    end: endOfDay(range.to),
  });
}

export const transactionService = {
  async list(filters?: {
    search?: string;
    status?: TransactionStatus | "all";
    type?: TransactionType | "all";
    category?: string;
    range?: DateRange;
    page?: number;
    pageSize?: number;
  }) {
    await delay(500);
    let data = [...MOCK_TRANSACTIONS];
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      data = data.filter(
        (t) =>
          t.transactionId.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          t.mobile.includes(q) ||
          (t.utr?.toLowerCase().includes(q) ?? false)
      );
    }
    if (filters?.status && filters.status !== "all") {
      data = data.filter((t) => t.status === filters.status);
    }
    if (filters?.type && filters.type !== "all") {
      data = data.filter((t) => t.type === filters.type);
    }
    if (filters?.category) {
      data = data.filter((t) => t.category === filters.category);
    }
    if (filters?.range) {
      data = data.filter((t) => inRange(t.createdAt, filters.range));
    }
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 10;
    const start = (page - 1) * pageSize;
    return {
      data: data.slice(start, start + pageSize),
      total: data.length,
      all: data,
    };
  },

  async dashboardStats(range: DateRange): Promise<DashboardStats> {
    await delay(600);
    const tx = MOCK_TRANSACTIONS.filter((t) => inRange(t.createdAt, range));
    const payIns = tx.filter((t) => t.type === "payin");
    const payOuts = tx.filter(
      (t) => t.type === "payout" || t.type === "wallet_withdraw" || t.type === "bill"
    );
    const sum = (arr: Transaction[]) => arr.reduce((s, t) => s + t.amount, 0);
    const byStatus = (arr: Transaction[], status: TransactionStatus) =>
      arr.filter((t) => t.status === status);

    // Sensible defaults when sparse for selected day
    if (tx.length < 5 && range.preset === "today") {
      return {
        payIns: {
          total: { count: 1248, volume: 1842500 },
          success: { count: 1196, volume: 1758200 },
          failed: { count: 52, volume: 84300 },
        },
        payOuts: {
          total: { count: 842, volume: 1250000 },
          processed: { count: 780, volume: 1165000 },
          failed: { count: 28, volume: 42000 },
          pending: { count: 24, volume: 31000 },
          refund: { count: 10, volume: 12000 },
        },
      };
    }

    return {
      payIns: {
        total: { count: payIns.length, volume: sum(payIns) },
        success: {
          count: byStatus(payIns, "success").length,
          volume: sum(byStatus(payIns, "success")),
        },
        failed: {
          count: byStatus(payIns, "failed").length,
          volume: sum(byStatus(payIns, "failed")),
        },
      },
      payOuts: {
        total: { count: payOuts.length, volume: sum(payOuts) },
        processed: {
          count: byStatus(payOuts, "success").length,
          volume: sum(byStatus(payOuts, "success")),
        },
        failed: {
          count: byStatus(payOuts, "failed").length,
          volume: sum(byStatus(payOuts, "failed")),
        },
        pending: {
          count: byStatus(payOuts, "pending").length + byStatus(payOuts, "processing").length,
          volume:
            sum(byStatus(payOuts, "pending")) + sum(byStatus(payOuts, "processing")),
        },
        refund: {
          count: byStatus(payOuts, "refund").length,
          volume: sum(byStatus(payOuts, "refund")),
        },
      },
    };
  },

  async chart(days: number) {
    await delay(400);
    return getChartData(days);
  },
};

export const walletService = {
  async getBalance() {
    await delay(300);
    return MOCK_WALLET_BALANCE;
  },
  async getBanks() {
    await delay(300);
    return [...MOCK_BANK_ACCOUNTS];
  },
  async addFunds(payload: {
    customerName: string;
    mobile: string;
    paymentCategory: string;
    cardType: string;
    amount: number;
  }) {
    await delay(1200);
    if (payload.amount < 100) throw new Error("Minimum amount is ₹100");
    const next = MOCK_WALLET_BALANCE + payload.amount;
    mutateBalance(next);
    const tx: Transaction = {
      id: `tx-af-${Date.now()}`,
      transactionId: `TXN${Date.now().toString().slice(-8)}`,
      customerName: payload.customerName,
      mobile: payload.mobile,
      type: "wallet_add",
      category: payload.paymentCategory,
      amount: payload.amount,
      status: "success",
      createdAt: new Date().toISOString(),
      openingBalance: MOCK_WALLET_BALANCE - payload.amount,
      closingBalance: next,
      reference: `AF${Date.now()}`,
    };
    mutateTransactions([tx, ...MOCK_TRANSACTIONS]);
    return { balance: next, transaction: tx };
  },
  async verifyBank(payload: Omit<BankAccount, "id" | "verified">) {
    await delay(1400);
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(payload.ifsc)) {
      throw new Error("Invalid IFSC code");
    }
    if (payload.accountNumber.length < 9) {
      throw new Error("Invalid bank account number");
    }
    const account: BankAccount = {
      ...payload,
      id: `ba-${Date.now()}`,
      verified: true,
    };
    mutateBanks([account, ...MOCK_BANK_ACCOUNTS]);
    return account;
  },
  async deleteBank(id: string) {
    await delay(500);
    mutateBanks(MOCK_BANK_ACCOUNTS.filter((b) => b.id !== id));
    return true;
  },
  async withdraw(bankId: string, amount: number) {
    await delay(1200);
    const bank = MOCK_BANK_ACCOUNTS.find((b) => b.id === bankId);
    if (!bank) throw new Error("Bank account not found");
    if (!bank.verified) throw new Error("Bank account is not verified");
    if (amount > MOCK_WALLET_BALANCE) throw new Error("Insufficient wallet balance");
    if (amount < 100) throw new Error("Minimum withdrawal is ₹100");
    const next = MOCK_WALLET_BALANCE - amount;
    mutateBalance(next);
    const tx: Transaction = {
      id: `tx-wd-${Date.now()}`,
      transactionId: `TXN${Date.now().toString().slice(-8)}`,
      customerName: bank.holderName,
      mobile: CURRENT_USER.mobile,
      type: "wallet_withdraw",
      amount,
      status: "processing",
      utr: `UTR${Date.now()}`,
      createdAt: new Date().toISOString(),
      bankAccount: `XXXX${bank.accountNumber.slice(-4)}`,
      openingBalance: next + amount,
      closingBalance: next,
      reference: `WD${Date.now()}`,
    };
    mutateTransactions([tx, ...MOCK_TRANSACTIONS]);
    return { balance: next, transaction: tx };
  },
};

export const billPaymentService = {
  async fetchBill(payload: {
    category: string;
    customerName: string;
    consumerNumber: string;
    mobile: string;
    paymentAmount?: number;
  }): Promise<BillDetails> {
    await delay(1100);
    if (!payload.consumerNumber || payload.consumerNumber.length < 5) {
      throw new Error("Invalid consumer number");
    }
    const billAmount = payload.paymentAmount || Math.round((800 + Math.random() * 2200) * 100) / 100;
    const lateFee = Math.random() > 0.7 ? 50 : 0;
    return {
      customerName: payload.customerName,
      billNumber: `BN${Math.floor(Math.random() * 1e8)}`,
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      billAmount,
      lateFee,
      totalPayable: billAmount + lateFee,
      consumerNumber: payload.consumerNumber,
      category: payload.category,
    };
  },
  async payBill(bill: BillDetails, method: "wallet" | "other") {
    await delay(1200);
    if (method === "wallet" && bill.totalPayable > MOCK_WALLET_BALANCE) {
      throw new Error("Insufficient wallet balance");
    }
    if (method === "wallet") {
      mutateBalance(MOCK_WALLET_BALANCE - bill.totalPayable);
    }
    const tx: Transaction = {
      id: `tx-bill-${Date.now()}`,
      transactionId: `TXN${Date.now().toString().slice(-8)}`,
      customerName: bill.customerName,
      mobile: CURRENT_USER.mobile,
      type: "bill",
      category: bill.category,
      amount: bill.totalPayable,
      status: "success",
      createdAt: new Date().toISOString(),
      reference: bill.billNumber,
    };
    mutateTransactions([tx, ...MOCK_TRANSACTIONS]);
    return tx;
  },
};

export const qrService = {
  async submitPending(payload: {
    customerName: string;
    mobile: string;
    email: string;
    amount: number;
    utr: string;
    receiptName: string;
  }) {
    await delay(1000);
    if (MOCK_TRANSACTIONS.some((t) => t.utr === payload.utr)) {
      throw new Error("Duplicate UTR");
    }
    const tx: Transaction = {
      id: `tx-qr-${Date.now()}`,
      transactionId: `TXN${Date.now().toString().slice(-8)}`,
      customerName: payload.customerName,
      mobile: payload.mobile,
      email: payload.email,
      type: "qr",
      amount: payload.amount,
      status: "pending",
      utr: payload.utr,
      receiptName: payload.receiptName,
      createdAt: new Date().toISOString(),
    };
    mutateTransactions([tx, ...MOCK_TRANSACTIONS]);
    return tx;
  },
  async history(filters?: { search?: string; from?: string; to?: string }) {
    await delay(400);
    let data = MOCK_TRANSACTIONS.filter((t) => t.type === "qr");
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      data = data.filter(
        (t) =>
          t.transactionId.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          t.mobile.includes(q) ||
          (t.utr?.toLowerCase().includes(q) ?? false)
      );
    }
    if (filters?.from) {
      data = data.filter((t) => t.createdAt >= filters.from!);
    }
    if (filters?.to) {
      data = data.filter((t) => t.createdAt.slice(0, 10) <= filters.to!);
    }
    return data;
  },
};

export function defaultRange(preset: DateRange["preset"] = "today"): DateRange {
  const now = new Date();
  if (preset === "yesterday") {
    const y = subDays(now, 1);
    return { from: y, to: y, preset };
  }
  if (preset === "7d") return { from: subDays(now, 6), to: now, preset };
  if (preset === "30d") return { from: subDays(now, 29), to: now, preset };
  return { from: now, to: now, preset: "today" };
}
