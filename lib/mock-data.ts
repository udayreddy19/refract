import { subDays, format, startOfDay, endOfDay } from "date-fns";
import type {
  BankAccount,
  BillCategory,
  ChartPoint,
  Transaction,
} from "./types";

/** UI catalog data only — no login credentials live here */

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

export let MOCK_TRANSACTIONS: Transaction[] = [];

export let MOCK_WALLET_BALANCE = 0;

export let MOCK_BANK_ACCOUNTS: BankAccount[] = [];

export const QR_PRICING = {
  name: "UNISUSPE",
  domestic: "Rupay - 1.10%",
  business: "₹1,00,000/-",
  cardLimits: "-",
  enabled: false,
};

export function getChartData(days: number, transactions: Transaction[] = []): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(new Date(), i);
    const dayTx = transactions.filter((t) => {
      const td = new Date(t.createdAt);
      return td >= startOfDay(d) && td <= endOfDay(d);
    });
    points.push({
      label: days <= 1 ? format(d, "HH:00") : format(d, "dd MMM"),
      payIn: dayTx
        .filter((t) => t.type === "payin" || t.type === "wallet_add" || t.type === "qr")
        .reduce((s, t) => s + t.amount, 0),
      payOut: dayTx
        .filter((t) => t.type === "payout" || t.type === "wallet_withdraw" || t.type === "bill")
        .reduce((s, t) => s + t.amount, 0),
      success: dayTx.filter((t) => t.status === "success").length,
      failed: dayTx.filter((t) => t.status === "failed").length,
    });
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
