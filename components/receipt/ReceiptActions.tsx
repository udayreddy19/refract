"use client";

import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { useAppStore } from "@/store/app-store";

export type ReceiptData = {
  title: string;
  status: "success" | "failed";
  amount: number;
  transactionId?: string;
  customer?: string;
  category?: string;
  note?: string;
  at?: string;
};

export function ReceiptActions({ receipt }: { receipt: ReceiptData }) {
  const locale = useAppStore((s) => s.locale) as Locale;

  const printReceipt = () => {
    const w = window.open("", "_blank", "noopener,noreferrer,width=420,height=640");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Receipt</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#0b1f33}
        h1{font-size:18px;margin:0 0 8px}
        .ok{color:#0f9d58}.bad{color:#e53935}
        dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px}
        dt{color:#5a6f86} dd{margin:0;font-weight:600;text-align:right}
      </style></head><body>
      <h1>ReconcileX</h1>
      <p class="${receipt.status === "success" ? "ok" : "bad"}">${receipt.title} — ${receipt.status}</p>
      <dl>
        <dt>Amount</dt><dd>${formatINR(receipt.amount)}</dd>
        ${receipt.transactionId ? `<dt>Txn ID</dt><dd>${receipt.transactionId}</dd>` : ""}
        ${receipt.customer ? `<dt>Customer</dt><dd>${receipt.customer}</dd>` : ""}
        ${receipt.category ? `<dt>Category</dt><dd>${receipt.category}</dd>` : ""}
        ${receipt.note ? `<dt>Note</dt><dd>${receipt.note}</dd>` : ""}
        <dt>Date</dt><dd>${receipt.at || new Date().toLocaleString("en-IN")}</dd>
      </dl>
      <script>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  const share = async () => {
    const text = `ReconcileX ${receipt.title}\n${receipt.status.toUpperCase()}\nAmount: ${formatINR(receipt.amount)}\n${receipt.transactionId || ""}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "ReconcileX receipt", text });
        return;
      } catch {
        // fall through
      }
    }
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={printReceipt}>
        {t(locale, "downloadReceipt")}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => void share()}>
        {t(locale, "shareReceipt")}
      </Button>
    </div>
  );
}
