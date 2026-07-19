// All monetary amounts are in paise (integer). 1 INR = 100 paise.

export interface Order {
  id: string; // internal
  externalId: string; // e.g. "#1001" or WooCommerce Order ID
  gatewayTransactionId: string | null;
  grossAmountPaise: number;
  status: string; // financial_status
  paymentMethod: string;
  placedAt: Date;
  source: string; // "shopify" | "woocommerce" | "amazon" | "flipkart"
  raw: Record<string, string>;
}

export interface Payment {
  id: string; // payment_id
  orderId: string | null;
  amountPaise: number;
  feePaise: number;
  taxPaise: number;
  netPaise: number;
  method: string;
  status: string;
  capturedAt: Date;
  source: string; // "razorpay" | "stripe" | "cashfree" | "payu" | "shiprocket"
  raw: Record<string, string>;
}

export interface SettlementItem {
  id: string; // internal
  settlementId: string; // UTR
  paymentId: string | null;
  type: "PAYMENT" | "REFUND" | "ADJUSTMENT" | "DISPUTE";
  grossPaise: number;
  feePaise: number;
  taxPaise: number;
  netPaise: number;
  settledAt: Date;
  source: string; // gateway source identifier
  raw: Record<string, string>;
}

export type ExceptionType =
  | "SETTLED_NO_ORDER"
  | "PAID_NOT_SETTLED"
  | "AMOUNT_MISMATCH"
  | "FEE_ANOMALY"
  | "REFUND_MISMATCH"
  | "SETTLEMENT_OVERDUE";

export type ExceptionSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface Exception {
  id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  amountPaise: number;
  description: string;
  orderId?: string;
  orderNo?: string;
  paymentId?: string;
  settlementId?: string;
  diff?: number;
}

export type MatchType = "EXACT_ID" | "REF_AMOUNT" | "AWB_MATCH" | "ORDER_ID" | "MANUAL";

export interface Match {
  id: string;
  orderId: string;
  orderNo: string;
  paymentId: string;
  settlementItemId: string | null;
  matchType: MatchType;
  confidence: number;
  grossPaise: number;
  feePaise: number;
  taxPaise: number;
  netPaise: number;
  settledAt: Date | null;
}

export interface ReconResult {
  matches: Match[];
  exceptions: Exception[];
  summary: {
    totalOrders: number;
    totalPayments: number;
    totalSettlementItems: number;
    matchedCount: number;
    exceptionCount: number;
    totalGrossPaise: number;
    totalFeesPaise: number;
    totalNetPaise: number;
    amountAtRiskPaise: number;
    autoMatchRate: number; // 0-1
  };
  feeAudit: {
    totalChargedFeePaise: number;
    totalExpectedFeePaise: number;
    overchargePaise: number;
  };
}
