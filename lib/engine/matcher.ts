import type {
  Order,
  Payment,
  SettlementItem,
  Match,
  Exception,
  ReconResult,
  ExceptionType,
} from "./types";

// ─── Config ─────────────────────────────────────────────────────────────────

const SETTLEMENT_WINDOW_DAYS = 5; // T+5 = overdue
const AMOUNT_TOLERANCE_PAISE = 100; // ±₹1 for fuzzy match
const MS_PER_DAY = 86_400_000;
const DEFAULT_FEE_PCT = 0.02; // 2% default contracted rate

// ─── Utilities ───────────────────────────────────────────────────────────────

let _idCounter = 0;
function uid(prefix: string): string {
  return `${prefix}_${++_idCounter}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY;
}

function withinWindow(a: Date, b: Date, days: number): boolean {
  return daysBetween(a, b) <= days;
}

// ─── Step 1: ID Join ─────────────────────────────────────────────────────────
// Match Order.gatewayTransactionId → Payment.id (Gateway transaction ID)

function step1IdJoin(
  orders: Order[],
  payments: Payment[],
  settlementItems: SettlementItem[]
): {
  matches: Match[];
  unmatchedOrders: Order[];
  unmatchedPayments: Payment[];
  unmatchedSettlements: SettlementItem[];
} {
  const matches: Match[] = [];
  const matchedOrderIds = new Set<string>();
  const matchedPaymentIds = new Set<string>();

  const paymentById = new Map(payments.map((p) => [p.id, p]));
  const settlementByPaymentId = new Map<string, SettlementItem>();
  for (const si of settlementItems) {
    if (si.paymentId && si.type === "PAYMENT") {
      settlementByPaymentId.set(si.paymentId, si);
    }
  }

  for (const order of orders) {
    if (!order.gatewayTransactionId) continue;
    const payment = paymentById.get(order.gatewayTransactionId);
    if (!payment) continue;

    const si = settlementByPaymentId.get(payment.id) || null;
    matchedOrderIds.add(order.id);
    matchedPaymentIds.add(payment.id);

    matches.push({
      id: uid("m"),
      orderId: order.id,
      orderNo: order.externalId,
      paymentId: payment.id,
      settlementItemId: si?.id || null,
      matchType: "EXACT_ID",
      confidence: 1.0,
      grossPaise: order.grossAmountPaise,
      feePaise: payment.feePaise,
      taxPaise: payment.taxPaise,
      netPaise: payment.netPaise,
      settledAt: si?.settledAt || null,
    });
  }

  return {
    matches,
    unmatchedOrders: orders.filter((o) => !matchedOrderIds.has(o.id)),
    unmatchedPayments: payments.filter((p) => !matchedPaymentIds.has(p.id)),
    unmatchedSettlements: settlementItems.filter(
      (si) => !si.paymentId || !matchedPaymentIds.has(si.paymentId)
    ),
  };
}

// ─── Step 1.5: Order ID Join ────────────────────────────────────────────────
// Match Order.externalId (Shopify / WooCommerce Name) → Payment.orderId

function stepOrderIdJoin(
  orders: Order[],
  payments: Payment[],
  settlementItems: SettlementItem[]
): {
  matches: Match[];
  unmatchedOrders: Order[];
  unmatchedPayments: Payment[];
  unmatchedSettlements: SettlementItem[];
} {
  const matches: Match[] = [];
  const matchedOrderIds = new Set<string>();
  const matchedPaymentIds = new Set<string>();

  const settlementByPaymentId = new Map<string, SettlementItem>();
  for (const si of settlementItems) {
    if (si.paymentId && si.type === "PAYMENT") {
      settlementByPaymentId.set(si.paymentId, si);
    }
  }

  // Group unmatched payments by orderId string
  const paymentsByOrderId = new Map<string, Payment>();
  for (const p of payments) {
    if (p.orderId) {
      const cleanId = p.orderId.trim().toLowerCase().replace(/^#/, "");
      paymentsByOrderId.set(cleanId, p);
    }
  }

  for (const order of orders) {
    const cleanOrdNo = order.externalId.trim().toLowerCase().replace(/^#/, "");
    const payment = paymentsByOrderId.get(cleanOrdNo);
    if (!payment) continue;

    const si = settlementByPaymentId.get(payment.id) || null;
    matchedOrderIds.add(order.id);
    matchedPaymentIds.add(payment.id);

    matches.push({
      id: uid("m"),
      orderId: order.id,
      orderNo: order.externalId,
      paymentId: payment.id,
      settlementItemId: si?.id || null,
      matchType: payment.method === "cod" ? "AWB_MATCH" : "ORDER_ID",
      confidence: 0.95,
      grossPaise: order.grossAmountPaise,
      feePaise: payment.feePaise,
      taxPaise: payment.taxPaise,
      netPaise: payment.netPaise,
      settledAt: si?.settledAt || null,
    });
  }

  return {
    matches,
    unmatchedOrders: orders.filter((o) => !matchedOrderIds.has(o.id)),
    unmatchedPayments: payments.filter((p) => !matchedPaymentIds.has(p.id)),
    unmatchedSettlements: settlementItems.filter(
      (si) => !si.paymentId || !matchedPaymentIds.has(si.paymentId)
    ),
  };
}

// ─── Step 2: Reference + Amount + Window ────────────────────────────────────
// Match by: amount within tolerance AND time within 72h window

function step2RefAmountWindow(
  orders: Order[],
  payments: Payment[],
  settlementItems: SettlementItem[]
): {
  matches: Match[];
  unmatchedOrders: Order[];
  unmatchedPayments: Payment[];
  unmatchedSettlements: SettlementItem[];
} {
  const matches: Match[] = [];
  const matchedOrderIds = new Set<string>();
  const matchedPaymentIds = new Set<string>();

  const settlementByPaymentId = new Map<string, SettlementItem>();
  for (const si of settlementItems) {
    if (si.paymentId && si.type === "PAYMENT") {
      settlementByPaymentId.set(si.paymentId, si);
    }
  }

  for (const order of orders) {
    const candidates = payments.filter((p) => {
      const amountClose =
        Math.abs(p.amountPaise - order.grossAmountPaise) <=
        AMOUNT_TOLERANCE_PAISE;
      const timeClose = withinWindow(p.capturedAt, order.placedAt, 3); // 72h
      return amountClose && timeClose;
    });

    if (candidates.length === 1) {
      const payment = candidates[0];
      const si = settlementByPaymentId.get(payment.id) || null;
      matchedOrderIds.add(order.id);
      matchedPaymentIds.add(payment.id);

      matches.push({
        id: uid("m"),
        orderId: order.id,
        orderNo: order.externalId,
        paymentId: payment.id,
        settlementItemId: si?.id || null,
        matchType: "REF_AMOUNT",
        confidence: 0.85,
        grossPaise: order.grossAmountPaise,
        feePaise: payment.feePaise,
        taxPaise: payment.taxPaise,
        netPaise: payment.netPaise,
        settledAt: si?.settledAt || null,
      });
    }
  }

  return {
    matches,
    unmatchedOrders: orders.filter((o) => !matchedOrderIds.has(o.id)),
    unmatchedPayments: payments.filter((p) => !matchedPaymentIds.has(p.id)),
    unmatchedSettlements: settlementItems.filter(
      (si) => !si.paymentId || !matchedPaymentIds.has(si.paymentId)
    ),
  };
}

// ─── Exception Generation ────────────────────────────────────────────────────

function generateExceptions(
  allMatches: Match[],
  unmatchedOrders: Order[],
  unmatchedPayments: Payment[],
  unmatchedSettlements: SettlementItem[],
  now: Date
): Exception[] {
  const exceptions: Exception[] = [];
  const severityMap: Record<ExceptionType, Exception["severity"]> = {
    SETTLED_NO_ORDER: "HIGH",
    PAID_NOT_SETTLED: "HIGH",
    AMOUNT_MISMATCH: "HIGH",
    FEE_ANOMALY: "MEDIUM",
    REFUND_MISMATCH: "MEDIUM",
    SETTLEMENT_OVERDUE: "MEDIUM",
  };

  // 1. Settled with no matching order
  for (const si of unmatchedSettlements) {
    if (si.type !== "PAYMENT") continue;
    exceptions.push({
      id: uid("ex"),
      type: "SETTLED_NO_ORDER",
      severity: severityMap["SETTLED_NO_ORDER"],
      amountPaise: si.grossPaise,
      description: `Settlement line ₹${(si.grossPaise / 100).toLocaleString("en-IN")} (${si.settlementId}) has no matching order`,
      settlementId: si.settlementId,
      paymentId: si.paymentId || undefined,
    });
  }

  // 2. Orders paid but never settled
  for (const order of unmatchedOrders) {
    if (!["paid", "partially_paid", "completed"].includes(order.status.toLowerCase()))
      continue;
    const daysSince = daysBetween(order.placedAt, now);
    const type: ExceptionType =
      daysSince > SETTLEMENT_WINDOW_DAYS
        ? "SETTLEMENT_OVERDUE"
        : "PAID_NOT_SETTLED";
    exceptions.push({
      id: uid("ex"),
      type,
      severity: severityMap[type],
      amountPaise: order.grossAmountPaise,
      description:
        type === "SETTLEMENT_OVERDUE"
          ? `Order ${order.externalId} (₹${(order.grossAmountPaise / 100).toLocaleString("en-IN")}) paid ${Math.floor(daysSince)}d ago — overdue for settlement`
          : `Order ${order.externalId} (₹${(order.grossAmountPaise / 100).toLocaleString("en-IN")}) paid but no settlement found yet`,
      orderId: order.id,
      orderNo: order.externalId,
    });
  }

  // 3. Amount mismatch in matched records
  for (const match of allMatches) {
    const diff = Math.abs(match.grossPaise - match.netPaise - match.feePaise - match.taxPaise);
    if (diff > AMOUNT_TOLERANCE_PAISE) {
      exceptions.push({
        id: uid("ex"),
        type: "AMOUNT_MISMATCH",
        severity: severityMap["AMOUNT_MISMATCH"],
        amountPaise: Math.abs(diff),
        description: `Order ${match.orderNo}: gross ₹${(match.grossPaise / 100).toLocaleString("en-IN")} — settlement reconciles to ₹${((match.netPaise + match.feePaise + match.taxPaise) / 100).toLocaleString("en-IN")} (diff ₹${(diff / 100).toLocaleString("en-IN")})`,
        orderId: match.orderId,
        orderNo: match.orderNo,
        paymentId: match.paymentId,
        diff,
      });
    }
  }

  // 4. Fee anomaly — charged > expected by >5%
  for (const match of allMatches) {
    const expectedFee = Math.round(match.grossPaise * DEFAULT_FEE_PCT);
    const chargedFee = match.feePaise;
    if (chargedFee > expectedFee * 1.05) {
      const overcharge = chargedFee - expectedFee;
      exceptions.push({
        id: uid("ex"),
        type: "FEE_ANOMALY",
        severity: severityMap["FEE_ANOMALY"],
        amountPaise: overcharge,
        description: `Order ${match.orderNo}: expected fee ₹${(expectedFee / 100).toFixed(2)}, charged ₹${(chargedFee / 100).toFixed(2)} — overcharge ₹${(overcharge / 100).toFixed(2)}`,
        orderId: match.orderId,
        orderNo: match.orderNo,
        paymentId: match.paymentId,
        diff: overcharge,
      });
    }
  }

  return exceptions;
}

// ─── Fee Audit ───────────────────────────────────────────────────────────────

function computeFeeAudit(
  matches: Match[],
  contractedFeePct: number = DEFAULT_FEE_PCT
): ReconResult["feeAudit"] {
  let totalCharged = 0;
  let totalExpected = 0;
  for (const m of matches) {
    totalCharged += m.feePaise + m.taxPaise;
    totalExpected += Math.round(m.grossPaise * contractedFeePct * 1.18); // include 18% GST
  }
  return {
    totalChargedFeePaise: totalCharged,
    totalExpectedFeePaise: totalExpected,
    overchargePaise: Math.max(0, totalCharged - totalExpected),
  };
}

// ─── Main Engine Entry Point ─────────────────────────────────────────────────

export function runRecon(
  orders: Order[],
  payments: Payment[],
  settlementItems: SettlementItem[],
  options: { contractedFeePct?: number } = {}
): ReconResult {
  _idCounter = 0; // reset for determinism
  const now = new Date();

  // Step 1: ID join
  const step1 = step1IdJoin(orders, payments, settlementItems);

  // Step 1.5: Order ID Join (for WooCommerce, Cashfree, PayU, and Marketplaces)
  const step1_5 = stepOrderIdJoin(
    step1.unmatchedOrders,
    step1.unmatchedPayments,
    step1.unmatchedSettlements
  );

  const allMatches: Match[] = [...step1.matches, ...step1_5.matches];

  // Step 2: Ref + Amount + Window on remainders
  const step2 = step2RefAmountWindow(
    step1_5.unmatchedOrders,
    step1_5.unmatchedPayments,
    step1_5.unmatchedSettlements
  );
  allMatches.push(...step2.matches);

  // Residuals → exceptions
  const exceptions = generateExceptions(
    allMatches,
    step2.unmatchedOrders,
    step2.unmatchedPayments,
    step2.unmatchedSettlements,
    now
  );

  const feeAudit = computeFeeAudit(allMatches, options.contractedFeePct);

  const totalGross = allMatches.reduce((s, m) => s + m.grossPaise, 0);
  const totalFees = allMatches.reduce((s, m) => s + m.feePaise + m.taxPaise, 0);
  const totalNet = allMatches.reduce((s, m) => s + m.netPaise, 0);
  const amountAtRisk = exceptions.reduce((s, e) => s + e.amountPaise, 0);

  return {
    matches: allMatches,
    exceptions,
    summary: {
      totalOrders: orders.length,
      totalPayments: payments.length,
      totalSettlementItems: settlementItems.length,
      matchedCount: allMatches.length,
      exceptionCount: exceptions.length,
      totalGrossPaise: totalGross,
      totalFeesPaise: totalFees,
      totalNetPaise: totalNet,
      amountAtRiskPaise: amountAtRisk,
      autoMatchRate:
        orders.length > 0 ? allMatches.length / orders.length : 0,
    },
    feeAudit,
  };
}
