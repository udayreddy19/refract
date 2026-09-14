import { subDays, format, startOfDay, endOfDay } from "date-fns";
import type {
  AgentUser,
  BankAccount,
  BillCategory,
  ChartPoint,
  Transaction,
} from "./types";

export const MOCK_CREDENTIALS = {
  agentId: "AGENT1001",
  passcode: "123456",
} as const;

/** Production + demo agent accounts (client mock auth until backend is wired) */
export type AgentAccount = AgentUser & { passcode: string };

export const AGENT_ACCOUNTS: AgentAccount[] = [
  {
    id: "u1",
    name: "AGENT USER",
    agentId: "AGENT1001",
    mobile: "+91 9000000000",
    email: "agent@example.com",
    avatarInitials: "AU",
    passcode: "123456",
  },
  {
    id: "u-prod",
    name: "PROD AGENT",
    agentId: "AGENTPROD",
    mobile: "+91 9876543210",
    email: "prod@payflow.agent",
    avatarInitials: "PA",
    passcode: "PayFlow@2026",
  },
];

export function findAgentAccount(agentIdOrMobile: string, passcode: string): AgentUser | null {
  const key = agentIdOrMobile.trim().toUpperCase();
  const digits = agentIdOrMobile.replace(/\D/g, "");
  const account = AGENT_ACCOUNTS.find((a) => {
    const idMatch = a.agentId.toUpperCase() === key;
    const mobileMatch = digits.length >= 10 && a.mobile.replace(/\D/g, "").endsWith(digits.slice(-10));
    return (idMatch || mobileMatch) && a.passcode === passcode;
  });
  if (!account) return null;
  const { passcode: _, ...user } = account;
  return user;
}

export const CURRENT_USER: AgentUser = {
  id: AGENT_ACCOUNTS[0].id,
  name: AGENT_ACCOUNTS[0].name,
  agentId: AGENT_ACCOUNTS[0].agentId,
  mobile: AGENT_ACCOUNTS[0].mobile,
  email: AGENT_ACCOUNTS[0].email,
  avatarInitials: AGENT_ACCOUNTS[0].avatarInitials,
};


export const BILL_CATEGORIES: BillCategory[] = [
  { id: "credit-card", name: "Credit Card", icon: "CreditCard", color: "#126B73", bg: "#E6F3F4" },
  { id: "electricity", name: "Electricity", icon: "Zap", color: "#F59E0B", bg: "#FFFBEB" },
  { id: "fastag", name: "FASTag", icon: "Car", color: "#3B82F6", bg: "#EFF6FF" },
  { id: "water", name: "Water", icon: "Droplets", color: "#0EA5E9", bg: "#F0F9FF" },
  { id: "education", name: "Education", icon: "GraduationCap", color: "#8B5CF6", bg: "#F5F3FF" },
  { id: "broadband", name: "Broadband", icon: "Wifi", color: "#14B8A6", bg: "#F0FDFA" },
  { id: "insurance", name: "Insurance/LIC", icon: "Shield", color: "#EF4444", bg: "#FEF2F2" },
  { id: "landline", name: "Landline Postpaid", icon: "Phone", color: "#6366F1", bg: "#EEF2FF" },
  { id: "recharge", name: "Recharge", icon: "Smartphone", color: "#22C55E", bg: "#ECFDF5" },
  { id: "dth", name: "DTH", icon: "Tv", color: "#EC4899", bg: "#FDF2F8" },
  { id: "municipal", name: "Municipal Tax", icon: "Building2", color: "#78716C", bg: "#F5F5F4" },
  { id: "donation", name: "Donation", icon: "Heart", color: "#F43F5E", bg: "#FFF1F2" },
  { id: "cable", name: "Cable TV", icon: "Monitor", color: "#A855F7", bg: "#FAF5FF" },
  { id: "gas", name: "Piped Gas", icon: "Flame", color: "#F97316", bg: "#FFF7ED" },
  { id: "loan", name: "Loan Repayment", icon: "Landmark", color: "#0F766E", bg: "#CCFBF1" },
  { id: "subscriptions", name: "Subscriptions", icon: "Repeat", color: "#2563EB", bg: "#DBEAFE" },
  { id: "housing", name: "Housing Society", icon: "Home", color: "#059669", bg: "#D1FAE5" },
  { id: "hospital", name: "Hospital & Pathology", icon: "Hospital", color: "#DC2626", bg: "#FEE2E2" },
  { id: "rd", name: "Recurring Deposits", icon: "PiggyBank", color: "#CA8A04", bg: "#FEF9C3" },
  { id: "clubs", name: "Clubs & Associations", icon: "Users", color: "#7C3AED", bg: "#EDE9FE" },
];

export const CATEGORY_TYPES = [
  { id: "ecom", name: "ECOM", description: "E-commerce payments", icon: "ShoppingBag" },
  { id: "education", name: "Education", description: "Education fee collections", icon: "GraduationCap" },
  { id: "travel", name: "Travel", description: "Travel & booking payments", icon: "Plane" },
] as const;

export const PAYMENT_CATEGORIES: Record<string, string[]> = {
  ecom: ["Online Marketplace", "Retail Store", "Digital Goods"],
  education: ["School Fees", "College Fees", "Coaching"],
  travel: ["Flight Booking", "Hotel Booking", "Cab Services"],
};

export const CARD_TYPES = ["Credit Card", "Debit Card", "Prepaid Card"];

const customers = [
  "Rahul Sharma",
  "Priya Patel",
  "Amit Kumar",
  "Sneha Reddy",
  "Vikram Singh",
  "Ananya Iyer",
  "Rohit Mehta",
  "Kavya Nair",
  "Suresh Gupta",
  "Meera Joshi",
];

const statuses = ["success", "failed", "pending", "refund", "processing"] as const;
const types = ["payin", "payout", "bill", "wallet_add", "wallet_withdraw", "qr"] as const;

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function makeTransactions(count: number): Transaction[] {
  const list: Transaction[] = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(rand() * 45);
    const date = subDays(new Date(), daysAgo);
    date.setHours(Math.floor(rand() * 14) + 8, Math.floor(rand() * 60));
    const type = pick(types);
    const nonProcessing = statuses.filter((s) => s !== "processing");
    const status =
      type === "wallet_withdraw" && rand() > 0.7
        ? "processing"
        : pick(nonProcessing);
    const amount = Math.round((rand() * 45000 + 100) * 100) / 100;
    const opening = 70000 + Math.round(rand() * 30000);
    list.push({
      id: `tx-${i + 1}`,
      transactionId: `TXN${String(100000 + i)}`,
      customerName: pick(customers),
      mobile: `9${String(Math.floor(rand() * 1e9)).padStart(9, "0")}`,
      type,
      category: type === "bill" ? pick(BILL_CATEGORIES).name : undefined,
      amount,
      status,
      utr: status === "success" || status === "processing" ? `UTR${Math.floor(rand() * 1e12)}` : undefined,
      createdAt: date.toISOString(),
      reference: `REF${Math.floor(rand() * 1e8)}`,
      openingBalance: opening,
      closingBalance: type.includes("withdraw") || type === "payout" || type === "bill"
        ? opening - amount
        : opening + amount,
      bankAccount: type === "wallet_withdraw" ? `XXXX${Math.floor(1000 + rand() * 9000)}` : undefined,
      receiptName: type === "qr" ? `receipt-${i + 1}.jpg` : undefined,
      email: `customer${i}@example.com`,
    });
  }
  return list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export let MOCK_TRANSACTIONS: Transaction[] = makeTransactions(120);

export let MOCK_WALLET_BALANCE = 82265;

export let MOCK_BANK_ACCOUNTS: BankAccount[] = [
  {
    id: "ba1",
    holderName: "AGENT USER",
    accountNumber: "5020004292123",
    ifsc: "HDFC0001234",
    bankName: "HDFC Bank",
    fundType: "Wallet",
    verified: true,
  },
  {
    id: "ba2",
    holderName: "AGENT USER",
    accountNumber: "1234567890123",
    ifsc: "SBIN0004567",
    bankName: "State Bank of India",
    fundType: "Wallet",
    verified: true,
  },
];

export const QR_PRICING = {
  name: "UNISUSPE",
  domestic: "Rupay - 1.10%",
  business: "₹1,00,000/-",
  cardLimits: "-",
  enabled: false,
};

export function getChartData(days: number): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(new Date(), i);
    const dayTx = MOCK_TRANSACTIONS.filter((t) => {
      const td = new Date(t.createdAt);
      return td >= startOfDay(d) && td <= endOfDay(d);
    });
    points.push({
      label: days <= 1 ? format(d, "HH:00") : format(d, "dd MMM"),
      payIn: dayTx.filter((t) => t.type === "payin").reduce((s, t) => s + t.amount, 0),
      payOut: dayTx
        .filter((t) => t.type === "payout" || t.type === "wallet_withdraw")
        .reduce((s, t) => s + t.amount, 0),
      success: dayTx.filter((t) => t.status === "success").length,
      failed: dayTx.filter((t) => t.status === "failed").length,
    });
  }
  if (days === 1) {
    // hourly mock for today
    return Array.from({ length: 8 }, (_, i) => ({
      label: `${8 + i * 2}:00`,
      payIn: Math.round(rand() * 80000 + 10000),
      payOut: Math.round(rand() * 50000 + 5000),
      success: Math.floor(rand() * 40 + 10),
      failed: Math.floor(rand() * 5),
    }));
  }
  return points;
}

export function mutateTransactions(next: Transaction[]) {
  MOCK_TRANSACTIONS = next;
}

export function mutateBalance(next: number) {
  MOCK_WALLET_BALANCE = next;
}

export function mutateBanks(next: BankAccount[]) {
  MOCK_BANK_ACCOUNTS = next;
}
