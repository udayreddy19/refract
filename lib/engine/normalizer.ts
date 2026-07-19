import type { Order, Payment, SettlementItem } from "./types";

// ─── Utility ────────────────────────────────────────────────────────────────

function toPaise(value: string | number | undefined): number {
  if (value === undefined || value === null || value === "") return 0;
  const cleaned = String(value).replace(/[₹,\s]/g, "");
  const float = parseFloat(cleaned);
  if (isNaN(float)) return 0;
  return Math.round(float * 100);
}

function parseDate(value: string | undefined): Date {
  if (!value) return new Date(0);
  // Handle ISO, "YYYY-MM-DD HH:mm:ss", "DD/MM/YYYY" etc.
  const cleaned = value.trim();
  // Try ISO first
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;
  // Try DD/MM/YYYY
  const parts = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (parts) return new Date(`${parts[3]}-${parts[2]}-${parts[1]}`);
  return new Date(0);
}

function uid(prefix: string, i: number): string {
  return `${prefix}_${i}`;
}

// ─── Razorpay Settlement CSV Normalizer ─────────────────────────────────────
// Expected columns (Razorpay standard settlement report):
// settlement_id | payment_id | order_id | type | amount | fee | tax | description | created_at | settled_at
// Also handles alternate column names from real exports.

export function normalizeRazorpay(rows: Record<string, string>[]): {
  payments: Payment[];
  settlementItems: SettlementItem[];
} {
  const payments: Payment[] = [];
  const settlementItems: SettlementItem[] = [];
  const seenPayments = new Set<string>();

  rows.forEach((row, i) => {
    // Normalize keys — Razorpay sometimes uses different casing/spacing
    const r: Record<string, string> = {};
    for (const k of Object.keys(row)) {
      r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
    }

    const type = (r["type"] || r["entity_type"] || "PAYMENT").toUpperCase() as
      | "PAYMENT"
      | "REFUND"
      | "ADJUSTMENT"
      | "DISPUTE";

    const paymentId =
      r["payment_id"] || r["entity_id"] || r["razorpay_payment_id"] || "";
    const orderId =
      r["order_id"] || r["razorpay_order_id"] || r["linked_id"] || null;
    const settlementId =
      r["settlement_id"] || r["utr"] || r["transfer_id"] || `BATCH_${i}`;

    const grossPaise = toPaise(r["amount"] || r["gross"]);
    const feePaise = toPaise(r["fee"] || r["fees"]);
    const taxPaise = toPaise(r["tax"] || r["service_tax"] || r["gst"]);
    const netPaise = grossPaise - feePaise - taxPaise;

    const capturedAt = parseDate(
      r["created_at"] || r["payment_date"] || r["date"]
    );
    const settledAt = parseDate(
      r["settled_at"] || r["settlement_date"] || r["created_at"]
    );

    // Deduplicate payments
    if (paymentId && !seenPayments.has(paymentId) && type === "PAYMENT") {
      seenPayments.add(paymentId);
      payments.push({
        id: paymentId,
        orderId: orderId || null,
        amountPaise: grossPaise,
        feePaise,
        taxPaise,
        netPaise,
        method: r["method"] || r["payment_method"] || "unknown",
        status: r["status"] || "captured",
        capturedAt,
        source: "razorpay",
        raw: row,
      });
    }

    settlementItems.push({
      id: uid("si", i),
      settlementId,
      paymentId: paymentId || null,
      type: ["PAYMENT", "REFUND", "ADJUSTMENT", "DISPUTE"].includes(type)
        ? (type as SettlementItem["type"])
        : "PAYMENT",
      grossPaise,
      feePaise,
      taxPaise,
      netPaise,
      settledAt,
      source: "razorpay",
      raw: row,
    });
  });

  return { payments, settlementItems };
}

// ─── Shopify Orders CSV Normalizer ──────────────────────────────────────────
// Expected columns (Shopify standard order export):
// Name | Financial Status | Total | Paid at | Payment Method | Gateway Transaction ID
// Also handles: Subtotal, Taxes, Refunded Amount etc.

export function normalizeShopify(rows: Record<string, string>[]): Order[] {
  return rows
    .map((row, i) => {
      const r: Record<string, string> = {};
      for (const k of Object.keys(row)) {
        r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
      }

      const externalId =
        r["name"] ||
        r["order_name"] ||
        r["order_number"] ||
        r["order_id"] ||
        `#${1000 + i}`;

      const gatewayTransactionId =
        r["gateway_transaction_id"] ||
        r["payment_id"] ||
        r["razorpay_payment_id"] ||
        r["transaction_id"] ||
        null;

      const totalStr =
        r["total"] ||
        r["total_price"] ||
        r["amount"] ||
        r["grand_total"] ||
        "0";

      const grossAmountPaise = toPaise(totalStr);
      const status =
        r["financial_status"] ||
        r["payment_status"] ||
        r["status"] ||
        "paid";

      const placedAt = parseDate(
        r["paid_at"] ||
          r["created_at"] ||
          r["date"] ||
          r["order_date"] ||
          r["processed_at"]
      );

      return {
        id: uid("ord", i),
        externalId,
        gatewayTransactionId: gatewayTransactionId || null,
        grossAmountPaise,
        status,
        paymentMethod: r["payment_method"] || r["method"] || "unknown",
        placedAt,
        source: "shopify",
        raw: row,
      } as Order;
    })
    .filter((o) => o.grossAmountPaise > 0);
}

export function normalizeWooCommerce(rows: Record<string, string>[]): Order[] {
  return rows
    .map((row, i) => {
      const r: Record<string, string> = {};
      for (const k of Object.keys(row)) {
        r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
      }

      const externalId = r["order_number"] || r["order_id"] || r["id"] || `#WC_${1000 + i}`;
      const gatewayTransactionId = r["transaction_id"] || r["payment_transaction_id"] || null;
      const grossAmountPaise = toPaise(r["order_total"] || r["total"] || "0");
      const status = r["status"] || "completed";
      const placedAt = parseDate(r["date"] || r["order_date"] || r["paid_date"]);

      return {
        id: uid("wc_ord", i),
        externalId,
        gatewayTransactionId,
        grossAmountPaise,
        status,
        paymentMethod: r["payment_method_title"] || r["payment_method"] || "unknown",
        placedAt,
        source: "woocommerce",
        raw: row,
      } as Order;
    })
    .filter((o) => o.grossAmountPaise > 0);
}

export function normalizeStripe(rows: Record<string, string>[]): {
  payments: Payment[];
  settlementItems: SettlementItem[];
} {
  const payments: Payment[] = [];
  const settlementItems: SettlementItem[] = [];
  const seenPayments = new Set<string>();

  rows.forEach((row, i) => {
    const r: Record<string, string> = {};
    for (const k of Object.keys(row)) {
      r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
    }

    const type = (r["type"] || r["reporting_category"] || "charge").toLowerCase();
    const paymentId = r["id"] || r["balance_transaction_id"] || r["charge_id"] || "";
    const orderId = r["description"] || r["metadata_order_id"] || null;

    const grossPaise = toPaise(r["amount"] || r["gross"] || "0");
    const feePaise = toPaise(r["fee"] || "0");
    const taxPaise = toPaise(r["tax"] || "0");
    const netPaise = toPaise(r["net"] || String((grossPaise - feePaise) / 100));

    const date = parseDate(r["created"] || r["created_at"] || r["date"]);
    const settlementId = r["payout_id"] || r["settlement_id"] || `ST_BATCH_${i}`;

    if (paymentId && !seenPayments.has(paymentId) && (type.includes("charge") || type.includes("payment"))) {
      seenPayments.add(paymentId);
      payments.push({
        id: paymentId,
        orderId,
        amountPaise: grossPaise,
        feePaise,
        taxPaise,
        netPaise,
        method: r["card_brand"] || "card",
        status: r["status"] || "captured",
        capturedAt: date,
        source: "stripe",
        raw: row,
      });
    }

    settlementItems.push({
      id: uid("si_st", i),
      settlementId,
      paymentId: paymentId || null,
      type: type.includes("refund") ? "REFUND" : "PAYMENT",
      grossPaise,
      feePaise,
      taxPaise,
      netPaise,
      settledAt: date,
      source: "stripe",
      raw: row,
    });
  });

  return { payments, settlementItems };
}

export function normalizeCashfree(rows: Record<string, string>[]): {
  payments: Payment[];
  settlementItems: SettlementItem[];
} {
  const payments: Payment[] = [];
  const settlementItems: SettlementItem[] = [];
  const seenPayments = new Set<string>();

  rows.forEach((row, i) => {
    const r: Record<string, string> = {};
    for (const k of Object.keys(row)) {
      r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
    }

    const paymentId = r["transaction_id"] || r["cf_payment_id"] || "";
    const orderId = r["order_id"] || r["cf_order_id"] || null;
    const settlementId = r["utr"] || r["settlement_id"] || `CF_BATCH_${i}`;

    const grossPaise = toPaise(r["amount"] || r["transaction_amount"] || "0");
    const feePaise = toPaise(r["service_charge"] || r["fee"] || "0");
    const taxPaise = toPaise(r["service_tax"] || r["tax"] || r["gst"] || "0");
    const netPaise = grossPaise - feePaise - taxPaise;

    const date = parseDate(r["transaction_time"] || r["date"] || r["created_at"]);
    const settledAt = parseDate(r["settlement_date"] || r["settled_at"] || r["date"]);

    if (paymentId && !seenPayments.has(paymentId)) {
      seenPayments.add(paymentId);
      payments.push({
        id: paymentId,
        orderId,
        amountPaise: grossPaise,
        feePaise,
        taxPaise,
        netPaise,
        method: r["payment_gateway"] || "unknown",
        status: "captured",
        capturedAt: date,
        source: "cashfree",
        raw: row,
      });
    }

    settlementItems.push({
      id: uid("si_cf", i),
      settlementId,
      paymentId: paymentId || null,
      type: "PAYMENT",
      grossPaise,
      feePaise,
      taxPaise,
      netPaise,
      settledAt,
      source: "cashfree",
      raw: row,
    });
  });

  return { payments, settlementItems };
}

export function normalizePayU(rows: Record<string, string>[]): {
  payments: Payment[];
  settlementItems: SettlementItem[];
} {
  const payments: Payment[] = [];
  const settlementItems: SettlementItem[] = [];
  const seenPayments = new Set<string>();

  rows.forEach((row, i) => {
    const r: Record<string, string> = {};
    for (const k of Object.keys(row)) {
      r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
    }

    const paymentId = r["mihpayid"] || r["transaction_id"] || "";
    const orderId = r["txnid"] || r["order_id"] || null;
    const settlementId = r["utr"] || `PU_BATCH_${i}`;

    const grossPaise = toPaise(r["amount"] || "0");
    const feePaise = toPaise(r["service_fee"] || r["merch_fee"] || "0");
    const taxPaise = toPaise(r["service_tax"] || r["tax"] || "0");
    const netPaise = grossPaise - feePaise - taxPaise;

    const date = parseDate(r["addedon"] || r["date"] || r["created_at"]);
    const settledAt = parseDate(r["settled_date"] || r["settlement_date"] || r["date"]);

    if (paymentId && !seenPayments.has(paymentId)) {
      seenPayments.add(paymentId);
      payments.push({
        id: paymentId,
        orderId,
        amountPaise: grossPaise,
        feePaise,
        taxPaise,
        netPaise,
        method: r["mode"] || "unknown",
        status: "captured",
        capturedAt: date,
        source: "payu",
        raw: row,
      });
    }

    settlementItems.push({
      id: uid("si_pu", i),
      settlementId,
      paymentId: paymentId || null,
      type: "PAYMENT",
      grossPaise,
      feePaise,
      taxPaise,
      netPaise,
      settledAt,
      source: "payu",
      raw: row,
    });
  });

  return { payments, settlementItems };
}

export function normalizeShiprocket(rows: Record<string, string>[]): {
  payments: Payment[];
  settlementItems: SettlementItem[];
} {
  const payments: Payment[] = [];
  const settlementItems: SettlementItem[] = [];
  const seenPayments = new Set<string>();

  rows.forEach((row, i) => {
    const r: Record<string, string> = {};
    for (const k of Object.keys(row)) {
      r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
    }

    const awb = r["awb"] || r["awb_number"] || "";
    const orderId = r["order_id"] || r["channel_order_id"] || null;
    const settlementId = r["utr"] || r["remittance_id"] || `SR_BATCH_${i}`;

    const grossPaise = toPaise(r["cod_amount"] || r["amount"] || "0");
    const feePaise = toPaise(r["shipping_charges"] || r["charges"] || "0");
    const taxPaise = toPaise(r["tax"] || r["gst"] || "0");
    const netPaise = grossPaise - feePaise - taxPaise;

    const date = parseDate(r["delivery_date"] || r["date"]);
    const settledAt = parseDate(r["remittance_date"] || r["date"]);

    if (awb && !seenPayments.has(awb)) {
      seenPayments.add(awb);
      payments.push({
        id: awb,
        orderId,
        amountPaise: grossPaise,
        feePaise,
        taxPaise,
        netPaise,
        method: "cod",
        status: "delivered",
        capturedAt: date,
        source: "shiprocket",
        raw: row,
      });
    }

    settlementItems.push({
      id: uid("si_sr", i),
      settlementId,
      paymentId: awb || null,
      type: "PAYMENT",
      grossPaise,
      feePaise,
      taxPaise,
      netPaise,
      settledAt,
      source: "shiprocket",
      raw: row,
    });
  });

  return { payments, settlementItems };
}

export function normalizeAmazon(rows: Record<string, string>[]): {
  orders: Order[];
  payments: Payment[];
  settlementItems: SettlementItem[];
} {
  const orders: Order[] = [];
  const payments: Payment[] = [];
  const settlementItems: SettlementItem[] = [];
  const seenOrders = new Set<string>();
  const seenPayments = new Set<string>();

  rows.forEach((row, i) => {
    const r: Record<string, string> = {};
    for (const k of Object.keys(row)) {
      r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
    }

    const type = r["transaction_type"] || "";
    const orderId = r["order_id"] || "";
    if (!orderId) return;

    const amountPaise = toPaise(r["amount"] || "0");
    const date = parseDate(r["date_time"] || r["date"]);
    const settlementId = r["settlement_id"] || "AMZN_BATCH";

    if (!seenOrders.has(orderId) && type.toLowerCase().includes("order")) {
      seenOrders.add(orderId);
      orders.push({
        id: uid("amzn_ord", i),
        externalId: orderId,
        gatewayTransactionId: orderId,
        grossAmountPaise: amountPaise,
        status: "paid",
        placedAt: date,
        paymentMethod: "amazon_pay",
        source: "amazon",
        raw: row,
      });
    }

    if (type.toLowerCase().includes("order") || type.toLowerCase().includes("refund")) {
      const isRefund = type.toLowerCase().includes("refund");
      const paymentId = isRefund ? `ref_${orderId}` : `pay_${orderId}`;

      if (!seenPayments.has(paymentId)) {
        seenPayments.add(paymentId);
        payments.push({
          id: paymentId,
          orderId,
          amountPaise: Math.abs(amountPaise),
          feePaise: 0,
          taxPaise: 0,
          netPaise: Math.abs(amountPaise),
          method: "amazon_pay",
          status: "captured",
          capturedAt: date,
          source: "amazon",
          raw: row,
        });
      }

      settlementItems.push({
        id: uid("si_amzn", i),
        settlementId,
        paymentId,
        type: isRefund ? "REFUND" : "PAYMENT",
        grossPaise: Math.abs(amountPaise),
        feePaise: toPaise(r["commission"] || "0"),
        taxPaise: toPaise(r["tax"] || "0"),
        netPaise: Math.abs(amountPaise) - toPaise(r["commission"] || "0"),
        settledAt: date,
        source: "amazon",
        raw: row,
      });
    }
  });

  return { orders, payments, settlementItems };
}

export function normalizeFlipkart(rows: Record<string, string>[]): {
  orders: Order[];
  payments: Payment[];
  settlementItems: SettlementItem[];
} {
  const orders: Order[] = [];
  const payments: Payment[] = [];
  const settlementItems: SettlementItem[] = [];
  const seenOrders = new Set<string>();
  const seenPayments = new Set<string>();

  rows.forEach((row, i) => {
    const r: Record<string, string> = {};
    for (const k of Object.keys(row)) {
      r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
    }

    const orderId = r["order_id"] || "";
    if (!orderId) return;

    const amountPaise = toPaise(r["sale_amount"] || r["amount"] || "0");
    const date = parseDate(r["settlement_date"] || r["date"]);
    const settlementId = r["utr"] || "FLIP_BATCH";

    if (!seenOrders.has(orderId)) {
      seenOrders.add(orderId);
      orders.push({
        id: uid("flip_ord", i),
        externalId: orderId,
        gatewayTransactionId: orderId,
        grossAmountPaise: amountPaise,
        status: "paid",
        placedAt: date,
        paymentMethod: "flipkart_pay",
        source: "flipkart",
        raw: row,
      });
    }

    const paymentId = `pay_${orderId}`;
    if (!seenPayments.has(paymentId)) {
      seenPayments.add(paymentId);
      payments.push({
        id: paymentId,
        orderId,
        amountPaise,
        feePaise: 0,
        taxPaise: 0,
        netPaise: amountPaise,
        method: "flipkart_pay",
        status: "captured",
        capturedAt: date,
        source: "flipkart",
        raw: row,
      });
    }

    settlementItems.push({
      id: uid("si_flip", i),
      settlementId,
      paymentId,
      type: "PAYMENT",
      grossPaise: amountPaise,
      feePaise: toPaise(r["commission"] || "0") + toPaise(r["shipping_charge"] || "0"),
      taxPaise: toPaise(r["tax"] || "0"),
      netPaise: toPaise(r["net_settlement_amount"] || String(amountPaise / 100)),
      settledAt: date,
      source: "flipkart",
      raw: row,
    });
  });

  return { orders, payments, settlementItems };
}

export function normalizeGenericPlatform(rows: Record<string, string>[], source: string): Order[] {
  return rows
    .map((row, i) => {
      const r: Record<string, string> = {};
      for (const k of Object.keys(row)) {
        r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
      }

      const externalId =
        r["name"] ||
        r["order_name"] ||
        r["order_number"] ||
        r["order_id"] ||
        r["id"] ||
        `#${source.toUpperCase()}_${1000 + i}`;

      const gatewayTransactionId =
        r["gateway_transaction_id"] ||
        r["payment_id"] ||
        r["razorpay_payment_id"] ||
        r["transaction_id"] ||
        r["payment_transaction_id"] ||
        null;

      const totalStr =
        r["total"] ||
        r["total_price"] ||
        r["amount"] ||
        r["order_total"] ||
        r["grand_total"] ||
        "0";

      const grossAmountPaise = toPaise(totalStr);
      const status =
        r["financial_status"] ||
        r["payment_status"] ||
        r["status"] ||
        "paid";

      const placedAt = parseDate(
        r["paid_at"] ||
          r["created_at"] ||
          r["date"] ||
          r["order_date"] ||
          r["processed_at"] ||
          r["paid_date"]
      );

      return {
        id: uid(`${source}_ord`, i),
        externalId,
        gatewayTransactionId,
        grossAmountPaise,
        status,
        paymentMethod: r["payment_method"] || r["method"] || r["payment_method_title"] || "unknown",
        placedAt,
        source,
        raw: row,
      } as Order;
    })
    .filter((o) => o.grossAmountPaise > 0);
}

export function normalizeGenericGateway(rows: Record<string, string>[], source: string): {
  payments: Payment[];
  settlementItems: SettlementItem[];
} {
  const payments: Payment[] = [];
  const settlementItems: SettlementItem[] = [];
  const seenPayments = new Set<string>();

  rows.forEach((row, i) => {
    const r: Record<string, string> = {};
    for (const k of Object.keys(row)) {
      r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
    }

    const paymentId =
      r["payment_id"] ||
      r["transaction_id"] ||
      r["razorpay_payment_id"] ||
      r["entity_id"] ||
      r["mihpayid"] ||
      "";
    const orderId =
      r["order_id"] ||
      r["razorpay_order_id"] ||
      r["txnid"] ||
      r["linked_id"] ||
      null;
    const settlementId =
      r["settlement_id"] ||
      r["utr"] ||
      r["transfer_id"] ||
      `${source.toUpperCase()}_BATCH_${i}`;

    const grossPaise = toPaise(r["amount"] || r["gross"] || "0");
    const feePaise = toPaise(r["fee"] || r["fees"] || r["service_fee"] || r["merch_fee"] || "0");
    const taxPaise = toPaise(r["tax"] || r["service_tax"] || r["gst"] || "0");
    const netPaise = grossPaise - feePaise - taxPaise;

    const date = parseDate(
      r["created_at"] ||
        r["payment_date"] ||
        r["date"] ||
        r["transaction_time"] ||
        r["addedon"]
    );
    const settledAt = parseDate(
      r["settled_at"] ||
        r["settlement_date"] ||
        r["date"] ||
        r["created_at"]
    );

    if (paymentId && !seenPayments.has(paymentId)) {
      seenPayments.add(paymentId);
      payments.push({
        id: paymentId,
        orderId,
        amountPaise: grossPaise,
        feePaise,
        taxPaise,
        netPaise,
        method: r["method"] || r["payment_method"] || r["mode"] || "unknown",
        status: "captured",
        capturedAt: date,
        source,
        raw: row,
      });
    }

    settlementItems.push({
      id: uid(`si_${source}`, i),
      settlementId,
      paymentId: paymentId || null,
      type: "PAYMENT",
      grossPaise,
      feePaise,
      taxPaise,
      netPaise,
      settledAt,
      source,
      raw: row,
    });
  });

  return { payments, settlementItems };
}

export function normalizeGenericShipping(rows: Record<string, string>[], source: string): {
  payments: Payment[];
  settlementItems: SettlementItem[];
} {
  const payments: Payment[] = [];
  const settlementItems: SettlementItem[] = [];
  const seenPayments = new Set<string>();

  rows.forEach((row, i) => {
    const r: Record<string, string> = {};
    for (const k of Object.keys(row)) {
      r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
    }

    const awb = r["awb"] || r["awb_number"] || r["tracking_number"] || r["tracking_id"] || "";
    const orderId = r["order_id"] || r["channel_order_id"] || r["order_number"] || null;
    const settlementId = r["utr"] || r["remittance_id"] || r["settlement_id"] || `${source.toUpperCase()}_BATCH_${i}`;

    const grossPaise = toPaise(r["cod_amount"] || r["amount"] || r["total"] || "0");
    const feePaise = toPaise(r["shipping_charges"] || r["charges"] || r["freight"] || "0");
    const taxPaise = toPaise(r["tax"] || r["gst"] || "0");
    const netPaise = grossPaise - feePaise - taxPaise;

    const date = parseDate(r["delivery_date"] || r["date"] || r["delivered_at"]);
    const settledAt = parseDate(r["remittance_date"] || r["settlement_date"] || r["date"]);

    if (awb && !seenPayments.has(awb)) {
      seenPayments.add(awb);
      payments.push({
        id: awb,
        orderId,
        amountPaise: grossPaise,
        feePaise,
        taxPaise,
        netPaise,
        method: "cod",
        status: "delivered",
        capturedAt: date,
        source,
        raw: row,
      });
    }

    settlementItems.push({
      id: uid(`si_${source}`, i),
      settlementId,
      paymentId: awb || null,
      type: "PAYMENT",
      grossPaise,
      feePaise,
      taxPaise,
      netPaise,
      settledAt,
      source,
      raw: row,
    });
  });

  return { payments, settlementItems };
}

export function normalizeGenericMarketplace(rows: Record<string, string>[], source: string): {
  orders: Order[];
  payments: Payment[];
  settlementItems: SettlementItem[];
} {
  const orders: Order[] = [];
  const payments: Payment[] = [];
  const settlementItems: SettlementItem[] = [];
  const seenOrders = new Set<string>();
  const seenPayments = new Set<string>();

  rows.forEach((row, i) => {
    const r: Record<string, string> = {};
    for (const k of Object.keys(row)) {
      r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
    }

    const orderId = r["order_id"] || r["order_number"] || r["channel_order_id"] || "";
    if (!orderId) return;

    const amountPaise = toPaise(r["amount"] || r["sale_amount"] || r["total"] || "0");
    const date = parseDate(r["date"] || r["settlement_date"] || r["date_time"]);
    const settlementId = r["utr"] || r["settlement_id"] || `${source.toUpperCase()}_BATCH`;

    if (!seenOrders.has(orderId)) {
      seenOrders.add(orderId);
      orders.push({
        id: uid(`${source}_ord`, i),
        externalId: orderId,
        gatewayTransactionId: orderId,
        grossAmountPaise: amountPaise,
        status: "paid",
        placedAt: date,
        paymentMethod: `${source}_pay`,
        source,
        raw: row,
      });
    }

    const paymentId = `pay_${orderId}`;
    if (!seenPayments.has(paymentId)) {
      seenPayments.add(paymentId);
      payments.push({
        id: paymentId,
        orderId,
        amountPaise,
        feePaise: 0,
        taxPaise: 0,
        netPaise: amountPaise,
        method: `${source}_pay`,
        status: "captured",
        capturedAt: date,
        source,
        raw: row,
      });
    }

    settlementItems.push({
      id: uid(`si_${source}`, i),
      settlementId,
      paymentId,
      type: "PAYMENT",
      grossPaise: amountPaise,
      feePaise: toPaise(r["commission"] || r["fees"] || r["shipping_charge"] || "0"),
      taxPaise: toPaise(r["tax"] || r["gst"] || "0"),
      netPaise: toPaise(r["net_settlement_amount"] || r["net_amount"] || String((amountPaise - toPaise(r["commission"] || r["fees"] || "0")) / 100)),
      settledAt: date,
      source,
      raw: row,
    });
  });

  return { orders, payments, settlementItems };
}

export function normalizeGenericBank(rows: Record<string, string>[], source: string): {
  payments: Payment[];
  settlementItems: SettlementItem[];
} {
  const payments: Payment[] = [];
  const settlementItems: SettlementItem[] = [];
  const seenPayments = new Set<string>();

  rows.forEach((row, i) => {
    const r: Record<string, string> = {};
    for (const k of Object.keys(row)) {
      r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
    }

    const depositStr = r["deposit"] || r["credit"] || r["amount"] || r["transaction_amount"] || "0";
    const depositPaise = toPaise(depositStr);
    if (depositPaise <= 0) return;

    const refNo = r["reference_number"] || r["ref_no"] || r["cheque_ref_no"] || r["description"] || "";
    let utr = refNo;
    const utrMatch = refNo.match(/\b([A-Z0-9]{12,22})\b/i);
    if (utrMatch) {
      utr = utrMatch[1];
    }

    const date = parseDate(r["value_date"] || r["transaction_date"] || r["date"]);
    const paymentId = utr || uid(`bank_ref`, i);

    if (paymentId && !seenPayments.has(paymentId)) {
      seenPayments.add(paymentId);
      payments.push({
        id: paymentId,
        orderId: null,
        amountPaise: depositPaise,
        feePaise: 0,
        taxPaise: 0,
        netPaise: depositPaise,
        method: "bank_transfer",
        status: "captured",
        capturedAt: date,
        source,
        raw: row,
      });
    }

    settlementItems.push({
      id: uid(`si_${source}`, i),
      settlementId: paymentId,
      paymentId: paymentId,
      type: "PAYMENT",
      grossPaise: depositPaise,
      feePaise: 0,
      taxPaise: 0,
      netPaise: depositPaise,
      settledAt: date,
      source,
      raw: row,
    });
  });

  return { payments, settlementItems };
}

export function normalizeGenericAccounting(rows: Record<string, string>[], source: string): Order[] {
  return rows.map((row, i) => {
    const r: Record<string, string> = {};
    for (const k of Object.keys(row)) {
      r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
    }
    const externalId = r["voucher_number"] || r["invoice_number"] || r["invoice_id"] || r["reference_number"] || r["id"] || `#ACC_${1000 + i}`;
    const gatewayTransactionId = r["payment_reference"] || r["transaction_id"] || null;
    const grossAmountPaise = toPaise(r["amount"] || r["total"] || r["debit"] || "0");
    const status = "paid";
    const placedAt = parseDate(r["date"] || r["voucher_date"] || r["created_at"]);
    return {
      id: uid(`${source}_acc`, i),
      externalId,
      gatewayTransactionId,
      grossAmountPaise,
      status,
      paymentMethod: r["payment_type"] || "accounting_ledger",
      placedAt,
      source,
      raw: row
    } as Order;
  }).filter(o => o.grossAmountPaise > 0);
}

export function normalizeGenericAds(rows: Record<string, string>[], source: string): {
  payments: Payment[];
  settlementItems: SettlementItem[];
} {
  const payments: Payment[] = [];
  const settlementItems: SettlementItem[] = [];
  const seenPayments = new Set<string>();

  rows.forEach((row, i) => {
    const r: Record<string, string> = {};
    for (const k of Object.keys(row)) {
      r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
    }

    const amountStr = r["amount"] || r["cost"] || r["spent"] || "0";
    const amountPaise = toPaise(amountStr);
    if (amountPaise <= 0) return;

    const id = r["transaction_id"] || r["invoice_number"] || r["id"] || uid(`ad_ref`, i);
    const date = parseDate(r["date"] || r["created_at"]);

    if (id && !seenPayments.has(id)) {
      seenPayments.add(id);
      payments.push({
        id,
        orderId: null,
        amountPaise: 0,
        feePaise: amountPaise,
        taxPaise: 0,
        netPaise: -amountPaise,
        method: "ad_expense",
        status: "captured",
        capturedAt: date,
        source,
        raw: row,
      });
    }

    settlementItems.push({
      id: uid(`si_${source}`, i),
      settlementId: id,
      paymentId: id,
      type: "ADJUSTMENT",
      grossPaise: 0,
      feePaise: amountPaise,
      taxPaise: 0,
      netPaise: -amountPaise,
      settledAt: date,
      source,
      raw: row,
    });
  });

  return { payments, settlementItems };
}
