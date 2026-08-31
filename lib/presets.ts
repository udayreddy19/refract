const PRESET_KEY = "reconcilex_channel_preset";
const MAP_KEY = "reconcilex_column_maps";

export function loadChannelPreset<T extends string>(fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as string[];
    // If the saved preset was the old legacy default ["shopify", "razorpay"], ignore it and reset to fallback
    if (Array.isArray(parsed)) {
      if (
        parsed.length === 2 &&
        parsed.includes("shopify") &&
        parsed.includes("razorpay") &&
        fallback.length === 0
      ) {
        localStorage.removeItem(PRESET_KEY);
        return fallback;
      }
      return parsed as T[];
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function saveChannelPreset(sources: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRESET_KEY, JSON.stringify(sources));
}

export type ColumnMap = Record<string, string>; // expected -> csvHeader

export function loadColumnMap(source: string): ColumnMap | null {
  if (typeof window === "undefined") return null;
  try {
    const all = JSON.parse(localStorage.getItem(MAP_KEY) || "{}") as Record<string, ColumnMap>;
    return all[source] || null;
  } catch {
    return null;
  }
}

export function saveColumnMap(source: string, map: ColumnMap) {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(MAP_KEY) || "{}") as Record<string, ColumnMap>;
    all[source] = map;
    localStorage.setItem(MAP_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

/** Canonical fields we try to detect per channel category */
export const EXPECTED_FIELDS: Record<string, string[]> = {
  platform: ["order_id", "order_number", "total", "financial_status", "created_at", "payment_id"],
  gateway: ["payment_id", "order_id", "amount", "fee", "tax", "status", "settled_at", "method"],
  shipping: ["awb", "order_id", "amount", "remittance_date", "status"],
  marketplace: ["order_id", "settlement_id", "amount", "fee", "settled_at"],
  bank: ["date", "description", "amount", "balance", "reference"],
  accounting: ["date", "voucher", "amount", "ledger", "narration"],
  ads: ["date", "campaign", "spend", "clicks", "impressions"],
};

const ALIASES: Record<string, string[]> = {
  order_id: ["order id", "orderid", "order_number", "order no", "name", "#", "order"],
  order_number: ["order number", "order no", "name", "order_id"],
  payment_id: ["payment id", "paymentid", "txn id", "transaction id", "id", "payment_intent"],
  amount: ["amount", "gross", "total", "gross amount", "settlement amount", "paid"],
  fee: ["fee", "fees", "mdr", "charges", "gateway fee"],
  tax: ["tax", "gst", "igst", "cgst"],
  status: ["status", "financial_status", "payment status", "state"],
  settled_at: ["settled at", "settlement date", "payout date", "remittance date", "created_at"],
  method: ["method", "payment method", "mode"],
  awb: ["awb", "tracking", "tracking number", "lrn"],
  settlement_id: ["settlement id", "utr", "payout id", "remittance id"],
  date: ["date", "txn date", "value date", "posted date"],
  description: ["description", "narration", "particulars", "remarks"],
  balance: ["balance", "closing balance"],
  reference: ["reference", "ref", "cheque", "utr"],
  voucher: ["voucher", "voucher no", "entry"],
  ledger: ["ledger", "account"],
  narration: ["narration", "particulars"],
  campaign: ["campaign", "campaign name"],
  spend: ["spend", "cost", "amount"],
  clicks: ["clicks"],
  impressions: ["impressions", "impr"],
  total: ["total", "total price", "gross"],
  financial_status: ["financial status", "status", "payment status"],
  created_at: ["created at", "created", "order date", "date"],
};

function norm(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function autoMapHeaders(csvHeaders: string[], expected: string[]): ColumnMap {
  const map: ColumnMap = {};
  const available = csvHeaders.map((h) => ({ raw: h, n: norm(h) }));
  const used = new Set<string>();

  for (const field of expected) {
    const aliases = [field, ...(ALIASES[field] || [])].map(norm);
    const hit = available.find((h) => !used.has(h.raw) && aliases.some((a) => h.n === a || h.n.includes(a)));
    if (hit) {
      map[field] = hit.raw;
      used.add(hit.raw);
    }
  }
  return map;
}

export function applyColumnMap(
  rows: Record<string, string>[],
  map: ColumnMap
): Record<string, string>[] {
  return rows.map((row) => {
    const next: Record<string, string> = { ...row };
    for (const [expected, csvHeader] of Object.entries(map)) {
      if (csvHeader && row[csvHeader] !== undefined) {
        next[expected] = row[csvHeader];
        // also set common title-case variants normalizers look for
        next[expected.replace(/_/g, " ")] = row[csvHeader];
      }
    }
    return next;
  });
}

export function missingExpected(map: ColumnMap, expected: string[], minRequired = 2): string[] {
  const mapped = expected.filter((f) => map[f]);
  if (mapped.length >= minRequired) return [];
  return expected.filter((f) => !map[f]);
}
