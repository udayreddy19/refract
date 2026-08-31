import { runRecon, DEFAULT_MATCH_RULES } from "./matcher";
import type { Order, Payment, SettlementItem } from "./types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function makeOrder(partial: Partial<Order> & { externalId: string; grossAmountPaise: number }): Order {
  return {
    id: partial.id || `o_${partial.externalId}`,
    externalId: partial.externalId,
    gatewayTransactionId: partial.gatewayTransactionId ?? null,
    grossAmountPaise: partial.grossAmountPaise,
    status: partial.status || "paid",
    paymentMethod: partial.paymentMethod || "upi",
    placedAt: partial.placedAt || new Date("2026-01-01T10:00:00Z"),
    source: partial.source || "shopify",
    raw: {},
  };
}

function makePayment(partial: Partial<Payment> & { id: string; amountPaise: number }): Payment {
  return {
    id: partial.id,
    orderId: partial.orderId ?? null,
    amountPaise: partial.amountPaise,
    feePaise: partial.feePaise ?? 0,
    taxPaise: partial.taxPaise ?? 0,
    netPaise: partial.netPaise ?? partial.amountPaise,
    method: partial.method || "upi",
    status: partial.status || "captured",
    capturedAt: partial.capturedAt || new Date("2026-01-01T10:05:00Z"),
    source: partial.source || "razorpay",
    raw: {},
  };
}

function makeSettlement(partial: Partial<SettlementItem> & { settlementId: string; grossPaise: number }): SettlementItem {
  return {
    id: partial.id || `si_${partial.settlementId}`,
    settlementId: partial.settlementId,
    paymentId: partial.paymentId ?? null,
    type: partial.type || "PAYMENT",
    grossPaise: partial.grossPaise,
    feePaise: partial.feePaise ?? 0,
    taxPaise: partial.taxPaise ?? 0,
    netPaise: partial.netPaise ?? partial.grossPaise,
    settledAt: partial.settledAt || new Date("2026-01-03T10:00:00Z"),
    source: partial.source || "razorpay",
    raw: {},
  };
}

export function runMatcherSelfTests(): string[] {
  const logs: string[] = [];

  // Exact ID match
  {
    const orders = [
      makeOrder({
        externalId: "#1001",
        grossAmountPaise: 100000,
        gatewayTransactionId: "pay_abc",
      }),
    ];
    const payments = [makePayment({ id: "pay_abc", amountPaise: 100000, feePaise: 2000, netPaise: 98000 })];
    const settlements: SettlementItem[] = [
      makeSettlement({ settlementId: "UTR1", paymentId: "pay_abc", grossPaise: 100000, feePaise: 2000, netPaise: 98000 }),
    ];
    const result = runRecon(orders, payments, settlements);
    assert(result.matches.length === 1, "exact id should match once");
    assert(result.summary.matchedCount === 1, "matchedCount=1");
    logs.push("pass: exact id join");
  }

  // Overdue vs paid-not-settled with custom window
  {
    const old = new Date(Date.now() - 10 * 86400000);
    const orders = [makeOrder({ externalId: "#2001", grossAmountPaise: 50000, placedAt: old, gatewayTransactionId: null })];
    const result = runRecon(orders, [], [], {
      rules: { ...DEFAULT_MATCH_RULES, settlementWindowDays: 5 },
    });
    assert(
      result.exceptions.some((e) => e.type === "SETTLEMENT_OVERDUE"),
      "old unpaid should be overdue"
    );
    logs.push("pass: settlement overdue rule");
  }

  // Amount tolerance rule
  {
    const orders = [
      makeOrder({
        externalId: "#3001",
        grossAmountPaise: 100000,
        gatewayTransactionId: null,
      }),
    ];
    const payments = [
      makePayment({
        id: "pay_x",
        amountPaise: 100050,
        orderId: null,
        feePaise: 0,
        netPaise: 100050,
      }),
    ];
    const tight = runRecon(orders, payments, [], {
      rules: { amountTolerancePaise: 10, fuzzyWindowDays: 3 },
    });
    const loose = runRecon(orders, payments, [], {
      rules: { amountTolerancePaise: 100, fuzzyWindowDays: 3 },
    });
    assert(tight.matches.length === 0, "tight tolerance should not match");
    assert(loose.matches.length === 1, "loose tolerance should match");
    logs.push("pass: amount tolerance");
  }

  logs.push(`ok: ${logs.length} matcher checks`);
  return logs;
}

// Allow `npx tsx lib/engine/matcher.selftest.ts`
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  for (const line of runMatcherSelfTests()) {
    console.log(line);
  }
}
