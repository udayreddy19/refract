import { isWithinInterval, startOfDay, endOfDay, subDays } from "date-fns";
import { getChartData } from "@/lib/mock-data";
import type {
  AgentUser,
  BankAccount,
  BillDetails,
  DashboardStats,
  DateRange,
  Transaction,
  TransactionStatus,
  TransactionType,
} from "@/lib/types";
import {
  firebaseLoginWithGoogle,
  firebaseLogout,
  isFirebaseConfigured,
} from "@/lib/firebase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const BANKS_KEY = "payflow-agent-banks";

async function payflowApi<T>(
  path: string,
  init?: RequestInit & { idToken?: string }
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (init?.idToken) headers.Authorization = `Bearer ${init.idToken}`;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

function userFromAgentPayload(agent: {
  uid?: string;
  id?: string;
  agentId: string;
  name: string;
  email?: string;
  mobile?: string;
  avatarInitials?: string;
}): AgentUser {
  const name = agent.name || agent.agentId;
  return {
    id: agent.uid || agent.id || agent.agentId,
    name,
    agentId: agent.agentId.toUpperCase(),
    mobile: agent.mobile || "",
    email: agent.email || `${agent.agentId.toLowerCase()}@payflow.agent`,
    avatarInitials:
      agent.avatarInitials ||
      name
        .split(/\s+/)
        .map((p) => p[0] || "")
        .join("")
        .slice(0, 2)
        .toUpperCase() ||
      "RX",
  };
}

function readBanks(): BankAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BANKS_KEY);
    return raw ? (JSON.parse(raw) as BankAccount[]) : [];
  } catch {
    return [];
  }
}

function writeBanks(banks: BankAccount[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BANKS_KEY, JSON.stringify(banks));
}

export const authService = {
  async login(
    agentId: string,
    passcode: string
  ): Promise<{ token: string; user: AgentUser; idToken?: string; balance?: number }> {
    // Admin-created retailers authenticate against the PHP registry (MySQL/JSON).
    // Do not send a Firebase token here — a Firebase-only session with no retailer
    // row used to block passcode login.
    const res = await payflowApi<{
      success: boolean;
      agent: Parameters<typeof userFromAgentPayload>[0];
      balance: number;
      token?: string;
    }>("/api/payflow/login.php", {
      method: "POST",
      body: JSON.stringify({
        agentId: agentId.trim().toUpperCase(),
        passcode,
      }),
    });

    const user = userFromAgentPayload(res.agent);
    return {
      token: res.token || `session-${user.agentId}`,
      user,
      balance: res.balance,
    };
  },

  async loginWithGoogle(): Promise<{
    token: string;
    user: AgentUser;
    idToken?: string;
    balance?: number;
  }> {
    if (!isFirebaseConfigured()) {
      throw new Error("Firebase is not configured");
    }
    const { idToken, user: fbUser } = await firebaseLoginWithGoogle();
    const res = await payflowApi<{
      success: boolean;
      agent: Parameters<typeof userFromAgentPayload>[0];
      balance: number;
    }>("/api/payflow/login.php", {
      method: "POST",
      body: JSON.stringify({
        email: fbUser.email,
        name: fbUser.displayName,
      }),
      idToken,
    });
    const user = userFromAgentPayload(res.agent);
    return { token: idToken, user, idToken, balance: res.balance };
  },

  async logout() {
    try {
      await payflowApi("/api/payflow/me.php", {
        method: "POST",
        body: JSON.stringify({ action: "logout" }),
      });
    } catch {
      /* ignore */
    }
    try {
      await firebaseLogout();
    } catch {
      /* ignore */
    }
  },

  async changePasscode(current: string, next: string) {
    if (next.length < 6) throw new Error("New passcode must be at least 6 characters");
    await payflowApi("/api/payflow/me.php", {
      method: "POST",
      body: JSON.stringify({
        action: "change_passcode",
        currentPasscode: current,
        newPasscode: next,
      }),
    });
    return { success: true };
  },

  async session(): Promise<{ user: AgentUser; balance: number } | null> {
    try {
      const res = await payflowApi<{
        agent: Parameters<typeof userFromAgentPayload>[0];
        balance: number;
      }>("/api/payflow/me.php");
      return { user: userFromAgentPayload(res.agent), balance: res.balance };
    } catch {
      return null;
    }
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

function ledgerToTransaction(e: {
  id: string;
  type?: string;
  amount: number;
  balance?: number;
  createdAt: string;
  note?: string;
  utr?: string;
}): Transaction {
  const amt = Number(e.amount) || 0;
  let type: TransactionType = "wallet_add";
  if (e.type === "admin_debit" || e.type === "wallet_withdraw" || e.type === "bill" || amt < 0) {
    type = e.type === "bill" ? "bill" : "wallet_withdraw";
  } else if (e.type === "qr") {
    type = "qr";
  } else if (e.type === "wallet_add" || e.type === "admin_credit") {
    type = "wallet_add";
  }
  return {
    id: e.id,
    transactionId: e.id,
    customerName: e.note || (e.type || "Wallet").replace(/_/g, " "),
    mobile: "",
    type,
    amount: Math.abs(amt),
    status: "success",
    utr: e.utr,
    createdAt: e.createdAt,
    closingBalance: e.balance,
    reference: e.type,
  };
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
    const res = await payflowApi<{
      entries: Array<{
        id: string;
        type?: string;
        amount: number;
        balance?: number;
        createdAt: string;
        note?: string;
        utr?: string;
      }>;
    }>("/api/payflow/wallet/balance.php?limit=500");
    let data = (res.entries || []).map(ledgerToTransaction);

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      data = data.filter(
        (t) =>
          t.transactionId.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
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
    const { all: tx } = await this.list({ range, page: 1, pageSize: 1000 });
    const payIns = tx.filter(
      (t) => t.type === "payin" || t.type === "wallet_add" || t.type === "qr"
    );
    const payOuts = tx.filter(
      (t) => t.type === "payout" || t.type === "wallet_withdraw" || t.type === "bill"
    );
    const sum = (arr: Transaction[]) => arr.reduce((s, t) => s + t.amount, 0);
    const byStatus = (arr: Transaction[], status: TransactionStatus) =>
      arr.filter((t) => t.status === status);

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
          count: byStatus(payOuts, "pending").length,
          volume: sum(byStatus(payOuts, "pending")),
        },
        refund: {
          count: byStatus(payOuts, "refund").length,
          volume: sum(byStatus(payOuts, "refund")),
        },
      },
    };
  },

  async chart(days: 1 | 7 | 30) {
    const range: DateRange = {
      from: subDays(new Date(), days - 1),
      to: new Date(),
    };
    const { all } = await this.list({ range, pageSize: 1000 });
    return getChartData(days, all);
  },
};

export const walletService = {
  async getBalance() {
    const res = await payflowApi<{ balance: number }>("/api/payflow/wallet/balance.php");
    return res.balance;
  },
  async getBanks() {
    return readBanks();
  },
  async addFunds() {
    throw new Error("Use Add Funds checkout — wallet top-ups go through Razorpay/Cashfree.");
  },
  async verifyBank(payload: Omit<BankAccount, "id" | "verified">) {
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
    writeBanks([account, ...readBanks()]);
    return account;
  },
  async deleteBank(id: string) {
    writeBanks(readBanks().filter((b) => b.id !== id));
    return true;
  },
  async withdraw(bankId: string, amount: number) {
    const bank = readBanks().find((b) => b.id === bankId);
    if (!bank) throw new Error("Bank account not found");
    if (!bank.verified) throw new Error("Bank account is not verified");
    if (amount < 100) throw new Error("Minimum withdrawal is ₹100");
    const res = await payflowApi<{ balance: number }>("/api/payflow/wallet/debit.php", {
      method: "POST",
      body: JSON.stringify({
        amount,
        type: "wallet_withdraw",
        note: `Withdraw to ${bank.bankName} XXXX${bank.accountNumber.slice(-4)}`,
      }),
    });
    return {
      balance: res.balance,
      transaction: {
        id: `tx-wd-${Date.now()}`,
        transactionId: `TXN${Date.now().toString().slice(-8)}`,
        customerName: bank.holderName,
        mobile: "",
        type: "wallet_withdraw" as const,
        amount,
        status: "processing" as const,
        createdAt: new Date().toISOString(),
        bankAccount: `XXXX${bank.accountNumber.slice(-4)}`,
        closingBalance: res.balance,
      },
    };
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
    if (!payload.consumerNumber || payload.consumerNumber.length < 5) {
      throw new Error("Invalid consumer number");
    }
    const billAmount =
      payload.paymentAmount && payload.paymentAmount > 0
        ? payload.paymentAmount
        : 0;
    if (billAmount <= 0) {
      throw new Error("Enter a valid bill amount to pay");
    }
    return {
      customerName: payload.customerName,
      billNumber: `BN${Date.now().toString().slice(-8)}`,
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      billAmount,
      lateFee: 0,
      totalPayable: billAmount,
      consumerNumber: payload.consumerNumber,
      category: payload.category,
    };
  },
  async payBill(bill: BillDetails, method: "wallet" | "other") {
    if (method !== "wallet") {
      throw new Error("Only wallet payments are supported right now");
    }
    const res = await payflowApi<{ balance: number }>("/api/payflow/wallet/debit.php", {
      method: "POST",
      body: JSON.stringify({
        amount: bill.totalPayable,
        type: "bill",
        note: `${bill.category} · ${bill.billNumber}`,
      }),
    });
    return {
      id: `tx-bill-${Date.now()}`,
      transactionId: `TXN${Date.now().toString().slice(-8)}`,
      customerName: bill.customerName,
      mobile: "",
      type: "bill" as const,
      category: bill.category,
      amount: bill.totalPayable,
      status: "success" as const,
      createdAt: new Date().toISOString(),
      reference: bill.billNumber,
      closingBalance: res.balance,
    } satisfies Transaction;
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
    if (!payload.utr.trim()) throw new Error("UTR is required");
    if (payload.amount <= 0) throw new Error("Amount must be greater than zero");
    // Record as pending QR collection note in agent ledger (no auto-credit)
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
    const key = "payflow-qr-pending";
    const prev = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    const list: Transaction[] = prev ? JSON.parse(prev) : [];
    if (list.some((t) => t.utr === payload.utr)) {
      throw new Error("Duplicate UTR");
    }
    list.unshift(tx);
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(list.slice(0, 200)));
    }
    return tx;
  },
  async history(filters?: { search?: string; from?: string; to?: string }) {
    const key = "payflow-qr-pending";
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    let data: Transaction[] = raw ? JSON.parse(raw) : [];
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
    if (filters?.from) data = data.filter((t) => t.createdAt >= filters.from!);
    if (filters?.to) data = data.filter((t) => t.createdAt.slice(0, 10) <= filters.to!);
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
