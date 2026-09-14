export type TransactionStatus =
  | "success"
  | "failed"
  | "pending"
  | "refund"
  | "processing";

export type TransactionType =
  | "payin"
  | "payout"
  | "bill"
  | "wallet_add"
  | "wallet_withdraw"
  | "qr";

export interface AgentUser {
  id: string;
  name: string;
  agentId: string;
  mobile: string;
  email: string;
  avatarInitials: string;
}

export interface Transaction {
  id: string;
  transactionId: string;
  customerName: string;
  mobile: string;
  type: TransactionType;
  category?: string;
  amount: number;
  status: TransactionStatus;
  utr?: string;
  createdAt: string;
  reference?: string;
  openingBalance?: number;
  closingBalance?: number;
  bankAccount?: string;
  receiptName?: string;
  email?: string;
}

export interface BankAccount {
  id: string;
  holderName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  fundType: "Wallet" | "Bank";
  verified: boolean;
}

export interface BillCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  bg: string;
}

export interface BillDetails {
  customerName: string;
  billNumber: string;
  dueDate: string;
  billAmount: number;
  lateFee: number;
  totalPayable: number;
  consumerNumber: string;
  category: string;
}

export interface WalletState {
  balance: number;
  bankAccounts: BankAccount[];
}

export interface DashboardStats {
  payIns: {
    total: { count: number; volume: number };
    success: { count: number; volume: number };
    failed: { count: number; volume: number };
  };
  payOuts: {
    total: { count: number; volume: number };
    processed: { count: number; volume: number };
    failed: { count: number; volume: number };
    pending: { count: number; volume: number };
    refund: { count: number; volume: number };
  };
}

export interface ChartPoint {
  label: string;
  payIn: number;
  payOut: number;
  success: number;
  failed: number;
}

export interface DateRange {
  from: Date;
  to: Date;
  preset?: "today" | "yesterday" | "7d" | "30d" | "custom";
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
