"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  animate,
} from "framer-motion";
import {
  normalizeRazorpay,
  normalizeShopify,
  normalizeWooCommerce,
  normalizeStripe,
  normalizeCashfree,
  normalizePayU,
  normalizeShiprocket,
  normalizeAmazon,
  normalizeFlipkart,
  normalizeGenericPlatform,
  normalizeGenericGateway,
  normalizeGenericShipping,
  normalizeGenericMarketplace,
  normalizeGenericBank,
  normalizeGenericAccounting,
  normalizeGenericAds
} from "@/lib/engine/normalizer";
import { runRecon } from "@/lib/engine/matcher";
import type { ReconResult, Exception, ExceptionType, Match, Order, Payment, SettlementItem } from "@/lib/engine/types";
import * as XLSX from "xlsx";
import GlassIcon from "@/components/GlassIcon";
import { Check, CheckCircle, AlertTriangle, AlertCircle, Coins, ShieldCheck, HelpCircle, ArrowLeft, Download, FileSpreadsheet, Hourglass, Percent, RotateCw, Ghost, Sparkles, CheckSquare } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

/* ── Formatting ──────────────────────────────────────────────────────────── */
function fmt(p: number) {
  return "₹" + (p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtShort(p: number) {
  const v = p / 100;
  if (v >= 100000) return "₹" + (v / 100000).toFixed(2) + "L";
  if (v >= 1000)   return "₹" + (v / 1000).toFixed(1) + "K";
  return "₹" + v.toLocaleString("en-IN");
}

const EX_META: Record<ExceptionType, { label: string; icon: any; severity: string; variant: "default" | "green" | "red" | "yellow" | "blue" | "dim" | "dark" }> = {
  SETTLED_NO_ORDER:  { label: "Settled, No Order",    icon: Ghost,         severity: "high",   variant: "red" },
  PAID_NOT_SETTLED:  { label: "Paid, Not Settled",    icon: Hourglass,     severity: "high",   variant: "red" },
  AMOUNT_MISMATCH:   { label: "Amount Mismatch",      icon: AlertTriangle, severity: "high",   variant: "red" },
  FEE_ANOMALY:       { label: "Fee Anomaly",          icon: Percent,       severity: "medium", variant: "yellow" },
  REFUND_MISMATCH:   { label: "Refund Mismatch",      icon: RotateCw,      severity: "medium", variant: "yellow" },
  SETTLEMENT_OVERDUE:{ label: "Settlement Overdue",   icon: AlertCircle,   severity: "medium", variant: "yellow" },
};

/* ── Animated counter ────────────────────────────────────────────────────── */
function AnimatedNumber({ to, prefix = "", suffix = "" }: { to: number; prefix?: string; suffix?: string }) {
  const ref  = useRef<HTMLSpanElement>(null);
  const from = 0;

  useEffect(() => {
    const controls = animate(from, to, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        if (ref.current) ref.current.textContent = prefix + Math.round(v).toLocaleString("en-IN") + suffix;
      },
    });
    return () => controls.stop();
  }, [to, prefix, suffix]);

  return <span ref={ref}>{prefix}0{suffix}</span>;
}

function AnimatedRupees({ paise }: { paise: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const controls = animate(0, paise / 100, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        if (ref.current) {
          if (v >= 100000) ref.current.textContent = "₹" + (v / 100000).toFixed(2) + "L";
          else if (v >= 1000) ref.current.textContent = "₹" + (v / 1000).toFixed(1) + "K";
          else ref.current.textContent = "₹" + v.toFixed(0);
        }
      },
    });
    return () => controls.stop();
  }, [paise]);
  return <span ref={ref}>₹0</span>;
}

/* ── Match rate bar ──────────────────────────────────────────────────────── */
function MatchRateBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="match-rate-bar">
      <span className="match-rate-label">Auto-match rate</span>
      <div className="match-rate-track" style={{ flex: 1 }}>
        <motion.div
          className="match-rate-fill"
          initial={{ width: "0%" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        />
      </div>
      <motion.span
        className="match-rate-pct"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 20 }}
      >
        {pct}%
      </motion.span>
      <span className="text-muted" style={{ fontSize: 13 }}>auto-matched</span>
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────────────────────── */
function StatCard({
  icon: IconComponent, value, label, color, index, isRupee = false, paise = 0, variant = "default" as const
}: {
  icon: any; value: string; label: string; color: string;
  index: number; isRupee?: boolean; paise?: number; variant?: any;
}) {
  return (
    <motion.div
      className={`stat-card ${color}`}
      variants={{
        hidden:  { opacity: 0, y: 28, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1,
          transition: { delay: index * 0.09, type: "spring", stiffness: 240, damping: 22 } },
      }}
      whileHover={{ y: -5, transition: { type: "spring", stiffness: 300, damping: 18 } }}
    >
      <div className="stat-card-icon" style={{ marginBottom: "var(--sp-2)" }}>
        <GlassIcon icon={IconComponent} variant={variant} size="md" />
      </div>
      <div className="stat-card-value">
        {isRupee ? <AnimatedRupees paise={paise} /> : <AnimatedNumber to={parseInt(value)} />}
      </div>
      <div className="stat-card-label">{label}</div>
    </motion.div>
  );
}

/* ── Exception row ───────────────────────────────────────────────────────── */
function ExceptionRow({ ex, index }: { ex: Exception; index: number }) {
  const meta = EX_META[ex.type] || { label: ex.type, icon: HelpCircle, severity: "low", variant: "dim" as const };
  return (
    <motion.tr
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.16,1,0.3,1] }}
    >
      <td><div style={{ fontWeight: 650, fontSize: 14 }}>{ex.orderNo || ex.paymentId || ex.settlementId || "—"}</div></td>
      <td>
        <span className={`ex-pill ${meta.severity}`} style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)" }}>
          <GlassIcon icon={meta.icon} variant={meta.variant} size="sm" />
          <span>{meta.label}</span>
        </span>
      </td>
      <td>
        <span className={`badge badge-${ex.severity === "HIGH" ? "red" : ex.severity === "MEDIUM" ? "yellow" : "gray"}`}>
          {ex.severity}
        </span>
      </td>
      <td><span className="amount negative">{fmt(ex.amountPaise)}</span></td>
      <td style={{ maxWidth: 300, fontSize: 13, color: "var(--text-secondary)" }}>{ex.description}</td>
    </motion.tr>
  );
}

/* ── Match row ───────────────────────────────────────────────────────────── */
function MatchRow({ match, index }: { match: Match; index: number }) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025, duration: 0.3 }}
    >
      <td style={{ fontWeight: 650 }}>{match.orderNo}</td>
      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--text-muted)" }}>
        {match.paymentId}
      </td>
      <td>
        <span className="badge badge-green" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <Check size={11} strokeWidth={3} />
          <span>{match.matchType === "EXACT_ID" ? "Exact ID" : "Ref+Amt"}</span>
        </span>
      </td>
      <td><span className="amount">{fmt(match.grossPaise)}</span></td>
      <td><span className="amount" style={{ color: "var(--text-muted)" }}>−{fmt(match.feePaise + match.taxPaise)}</span></td>
      <td><span className="amount positive">{fmt(match.netPaise)}</span></td>
      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {match.settledAt ? match.settledAt.toLocaleDateString("en-IN") : "Pending"}
      </td>
    </motion.tr>
  );
}

/* ── Excel export ────────────────────────────────────────────────────────── */
/* ── Excel export ────────────────────────────────────────────────────────── */
function autoFitColumns(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const cols: XLSX.ColInfo[] = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let maxWidth = 12; // default min width
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cellAddress = { c: C, r: R };
      const cellRef = XLSX.utils.encode_cell(cellAddress);
      const cell = ws[cellRef];
      if (cell && cell.v !== undefined) {
        let valStr = '';
        if (cell.t === 'n' && cell.z === '"₹"#,##0.00') {
          valStr = '₹' + Number(cell.v).toLocaleString("en-IN", { minimumFractionDigits: 2 }) + '  ';
        } else {
          valStr = String(cell.v);
        }
        if (valStr.length > maxWidth) {
          maxWidth = valStr.length;
        }
      }
    }
    cols.push({ wch: Math.min(maxWidth + 4, 45) });
  }
  ws['!cols'] = cols;
}

function formatSummarySheet(ws: XLSX.WorkSheet, result: ReconResult) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let R = range.s.r; R <= range.e.r; ++R) {
    const labelCell = ws[XLSX.utils.encode_cell({ c: 0, r: R })];
    const valCell = ws[XLSX.utils.encode_cell({ c: 1, r: R })];
    if (labelCell && valCell) {
      const label = String(labelCell.v);
      if (label.includes("Gross") || label.includes("Fees") || label.includes("Net") || label.includes("Risk") || label.includes("Charged") || label.includes("Expected") || label.includes("Overcharge")) {
        valCell.t = 'n';
        valCell.z = '"₹"#,##0.00';
      } else if (label.includes("Rate")) {
        valCell.v = result.summary.autoMatchRate;
        valCell.t = 'n';
        valCell.z = '0.0%';
      } else if (label.includes("Orders") || label.includes("Matched") || label.includes("Exceptions")) {
        valCell.t = 'n';
        valCell.z = '#,##0';
      }
    }
  }
}

function formatExceptionsSheet(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let R = 1; R <= range.e.r; ++R) {
    const amtCell = ws[XLSX.utils.encode_cell({ c: 3, r: R })];
    if (amtCell) {
      amtCell.t = 'n';
      amtCell.z = '"₹"#,##0.00';
    }
  }
}

function formatMatchedSheet(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let R = 1; R <= range.e.r; ++R) {
    for (let C of [3, 4, 5]) {
      const cell = ws[XLSX.utils.encode_cell({ c: C, r: R })];
      if (cell) {
        cell.t = 'n';
        cell.z = '"₹"#,##0.00';
      }
    }
  }
}

function exportToExcel(result: ReconResult) {
  const wb = XLSX.utils.book_new();
  const summaryData = [
    ["Refract — Reconciliation Report", ""],
    ["Generated", new Date().toLocaleString("en-IN")],
    ["", ""],
    ["SUMMARY", ""],
    ["Total Orders", result.summary.totalOrders],
    ["Matched", result.summary.matchedCount],
    ["Exceptions", result.summary.exceptionCount],
    ["Auto-match Rate", `${(result.summary.autoMatchRate * 100).toFixed(1)}%`],
    ["Total Gross (₹)", result.summary.totalGrossPaise / 100],
    ["Total Fees (₹)", result.summary.totalFeesPaise / 100],
    ["Total Net (₹)", result.summary.totalNetPaise / 100],
    ["Amount at Risk (₹)", result.summary.amountAtRiskPaise / 100],
    ["", ""],
    ["FEE AUDIT", ""],
    ["Charged Fees (₹)", result.feeAudit.totalChargedFeePaise / 100],
    ["Expected Fees (₹)", result.feeAudit.totalExpectedFeePaise / 100],
    ["Overcharge (₹)", result.feeAudit.overchargePaise / 100],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  formatSummarySheet(wsSummary, result);
  autoFitColumns(wsSummary);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  const wsExceptions = XLSX.utils.aoa_to_sheet([
    ["Order/Ref", "Type", "Severity", "Amount (₹)", "Description"],
    ...result.exceptions.map((e) => [e.orderNo||e.paymentId||"", EX_META[e.type]?.label||e.type, e.severity, e.amountPaise/100, e.description]),
  ]);
  formatExceptionsSheet(wsExceptions);
  autoFitColumns(wsExceptions);
  XLSX.utils.book_append_sheet(wb, wsExceptions, "Exceptions");

  const wsMatched = XLSX.utils.aoa_to_sheet([
    ["Order No","Payment ID","Match Type","Gross (₹)","Fee+Tax (₹)","Net (₹)","Settled At"],
    ...result.matches.map((m) => [m.orderNo,m.paymentId,m.matchType,m.grossPaise/100,(m.feePaise+m.taxPaise)/100,m.netPaise/100,m.settledAt?.toLocaleDateString("en-IN")||"Pending"]),
  ]);
  formatMatchedSheet(wsMatched);
  autoFitColumns(wsMatched);
  XLSX.utils.book_append_sheet(wb, wsMatched, "Matched Orders");

  XLSX.writeFile(wb, `refract_recon_${new Date().toISOString().split("T")[0]}.xlsx`);
}

/* ── Main Results Page ───────────────────────────────────────────────────── */
type FilterType = "ALL" | ExceptionType;

export default function ResultsPage() {
  const router = useRouter();
  const [result,      setResult]      = useState<ReconResult | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState<FilterType>("ALL");
  const [showMatched, setShowMatched] = useState(false);
  const [today,       setToday]       = useState("");

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }));
    try {
      const payloadRaw = sessionStorage.getItem("refract_payload");
      if (!payloadRaw) { router.replace("/"); return; }
      
      const payload = JSON.parse(payloadRaw);
      const { enabledSources, data } = payload;
      
      const orders: Order[] = [];
      const payments: Payment[] = [];
      const settlementItems: SettlementItem[] = [];
      
      enabledSources.forEach((src: string) => {
        const rows = data[src] || [];
        if (src === "shopify") {
          orders.push(...normalizeShopify(rows));
        } else if (src === "woocommerce") {
          orders.push(...normalizeWooCommerce(rows));
        } else if (src === "razorpay") {
          const res = normalizeRazorpay(rows);
          payments.push(...res.payments);
          settlementItems.push(...res.settlementItems);
        } else if (src === "stripe") {
          const res = normalizeStripe(rows);
          payments.push(...res.payments);
          settlementItems.push(...res.settlementItems);
        } else if (src === "cashfree") {
          const res = normalizeCashfree(rows);
          payments.push(...res.payments);
          settlementItems.push(...res.settlementItems);
        } else if (src === "payu") {
          const res = normalizePayU(rows);
          payments.push(...res.payments);
          settlementItems.push(...res.settlementItems);
        } else if (src === "shiprocket") {
          const res = normalizeShiprocket(rows);
          payments.push(...res.payments);
          settlementItems.push(...res.settlementItems);
        } else if (src === "amazon") {
          const res = normalizeAmazon(rows);
          orders.push(...res.orders);
          payments.push(...res.payments);
          settlementItems.push(...res.settlementItems);
        } else if (src === "flipkart") {
          const res = normalizeFlipkart(rows);
          orders.push(...res.orders);
          payments.push(...res.payments);
          settlementItems.push(...res.settlementItems);
        } else {
          // Generic fallbacks for newly added sources
          const platforms = ["magento", "bigcommerce", "dukaan", "fynd", "shopware", "prestashop"];
          const gateways = ["phonepe", "paytm", "instamojo", "ccavenue", "juspay", "billdesk", "easebuzz", "pinelabs", "paypal", "gpay"];
          const shipping = ["delhivery", "ecomexpress", "bluedart", "dtdc", "xpressbees", "shadowfax"];
          const marketplaces = ["meesho", "myntra", "nykaa", "ajio", "jiomart", "tatacliq", "snapdeal", "firstcry", "purplle", "pepperfry", "limeroad"];
          const banks = ["hdfc", "icici", "sbi", "axis", "kotak"];
          const accounting = ["tally", "zohobooks", "quickbooks"];
          const ads = ["googleads", "metaads"];

          if (platforms.includes(src)) {
            orders.push(...normalizeGenericPlatform(rows, src));
          } else if (gateways.includes(src)) {
            const res = normalizeGenericGateway(rows, src);
            payments.push(...res.payments);
            settlementItems.push(...res.settlementItems);
          } else if (shipping.includes(src)) {
            const res = normalizeGenericShipping(rows, src);
            payments.push(...res.payments);
            settlementItems.push(...res.settlementItems);
          } else if (marketplaces.includes(src)) {
            const res = normalizeGenericMarketplace(rows, src);
            orders.push(...res.orders);
            payments.push(...res.payments);
            settlementItems.push(...res.settlementItems);
          } else if (banks.includes(src)) {
            const res = normalizeGenericBank(rows, src);
            payments.push(...res.payments);
            settlementItems.push(...res.settlementItems);
          } else if (accounting.includes(src)) {
            orders.push(...normalizeGenericAccounting(rows, src));
          } else if (ads.includes(src)) {
            const res = normalizeGenericAds(rows, src);
            payments.push(...res.payments);
            settlementItems.push(...res.settlementItems);
          }
        }
      });
      
      setResult(runRecon(orders, payments, settlementItems));
    } catch { router.replace("/"); }
    finally { setLoading(false); }
  }, [router]);

  const displayed = useCallback(() => {
    if (!result) return [];
    return filter === "ALL" ? result.exceptions : result.exceptions.filter((e) => e.type === filter);
  }, [result, filter])();

  /* Loading */
  if (loading) return (
    <>
      <div className="page-root">
        <nav className="nav">
          <a href="/" className="nav-logo">
            <div className="nav-logo-mark">R</div>Refract
          </a>
        </nav>
        <div className="processing-overlay">
          <motion.div
            animate={{ rotate: 360 }} transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
            style={{ border: "3px solid var(--g-border)", borderTopColor: "var(--t-hi)", borderRadius: "50%", width: 48, height: 48 }}
          />
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-secondary">
            Running reconciliation engine…
          </motion.p>
        </div>
      </div>
    </>
  );

  if (!result) return null;

  const { summary, feeAudit } = result;

  const exByType = Object.entries(EX_META).map(([type, meta]) => ({
    type: type as ExceptionType, ...meta,
    count: result.exceptions.filter((e) => e.type === type).length,
  }));

  const pageVariants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const sectionVariant = {
    hidden:  { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16,1,0.3,1] as [number, number, number, number] } },
  };

  return (
    <>
      <div className="page-root">
        {/* Nav */}
        <motion.nav
          className="nav"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}
        >
          <a href="/" className="nav-logo">
            <div className="nav-logo-mark">R</div>
            Refract
          </a>
          <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center" }}>
            <span className="text-muted" style={{ fontSize: 12.5 }}>{today}</span>
            <ThemeToggle />
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              className="btn btn-secondary btn-sm" onClick={() => router.push("/")} id="new-recon-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <GlassIcon icon={ArrowLeft} variant="dim" size="sm" style={{ width: 20, height: 20, borderRadius: 4 }} />
              <span>New Recon</span>
            </motion.button>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              className="btn btn-primary btn-sm" onClick={() => exportToExcel(result)} id="export-excel-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <GlassIcon icon={Download} variant="dark" size="sm" style={{ width: 20, height: 20, borderRadius: 4 }} />
              <span>Export Excel</span>
            </motion.button>
          </div>
        </motion.nav>

        <main className="page-wrapper" style={{ paddingTop: "var(--sp-8)", paddingBottom: "var(--sp-16)" }}>
          <motion.div initial="hidden" animate="visible" variants={pageVariants}>

            {/* Page header */}
            <motion.div variants={sectionVariant} style={{ marginBottom: "var(--sp-8)" }}>
              <h1 style={{ fontSize: "1.7rem", fontWeight: 800, letterSpacing: "-0.04em" }}>
                Reconciliation Report
              </h1>
              <p className="text-secondary" style={{ fontSize: 13.5, marginTop: 5 }}>
                <AnimatedNumber to={summary.totalOrders} /> orders ·{" "}
                <AnimatedNumber to={summary.totalPayments} /> payments ·{" "}
                <AnimatedNumber to={summary.totalSettlementItems} /> settlement lines
              </p>
            </motion.div>

            {/* Match rate */}
            <motion.div variants={sectionVariant}>
              <MatchRateBar rate={summary.autoMatchRate} />
            </motion.div>

            {/* Stats */}
            <motion.div className="summary-bar" initial="hidden" animate="visible">
              <StatCard icon={CheckCircle} value={String(summary.matchedCount)} label="Orders Matched"  color="green"  index={0} variant="green" />
              <StatCard icon={AlertTriangle} value={String(summary.exceptionCount)} label="Exceptions"   color="red"    index={1} variant="red" />
              <StatCard icon={Coins} label="Net Settled"  color="purple" index={2} isRupee paise={summary.totalNetPaise}    value="" variant="default" />
              <StatCard icon={AlertCircle} label="Amount at Risk" color="yellow" index={3} isRupee paise={summary.amountAtRiskPaise} value="" variant="yellow" />
            </motion.div>

            {/* Fee audit banner */}
            <motion.div
              variants={sectionVariant}
              className={`fee-banner ${feeAudit.overchargePaise > 0 ? "danger" : "safe"}`}
            >
              <div className="fee-banner-left">
                <motion.div
                  className="fee-banner-icon"
                  animate={feeAudit.overchargePaise > 0 ? {
                    rotate: [0, -8, 8, -8, 0],
                    transition: { delay: 1.2, duration: 0.5 },
                  } : {}}
                  style={{ display: "flex", alignItems: "center" }}
                >
                  <GlassIcon
                    icon={feeAudit.overchargePaise > 0 ? AlertTriangle : ShieldCheck}
                    variant={feeAudit.overchargePaise > 0 ? "red" : "green"}
                    size="lg"
                  />
                </motion.div>
                <div>
                  <div className="fee-banner-title">
                    {feeAudit.overchargePaise > 0 ? "Gateway Fee Overcharge Detected" : "Fees Look Correct"}
                  </div>
                  <div className="fee-banner-sub">
                    Charged {fmt(feeAudit.totalChargedFeePaise)} · Expected ~{fmt(feeAudit.totalExpectedFeePaise)} (at contracted rates)
                  </div>
                </div>
              </div>
              <motion.div
                className="fee-amount"
                initial={{ opacity: 0, scale: 0.6, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ delay: 0.8, type: "spring", stiffness: 220, damping: 18 }}
              >
                {feeAudit.overchargePaise > 0 ? `${fmt(feeAudit.overchargePaise)} overcharged` : "No overcharges"}
              </motion.div>
            </motion.div>

            {/* Exceptions */}
            <motion.div variants={sectionVariant} style={{ marginBottom: "var(--sp-6)" }}>
              <div className="section-header">
                <div className="section-title" style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)" }}>
                  <GlassIcon icon={AlertCircle} variant="red" size="sm" />
                  <span>Exceptions</span>
                  <motion.span
                    className="badge badge-red"
                    key={summary.exceptionCount}
                    initial={{ scale: 1.4 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  >
                    {summary.exceptionCount}
                  </motion.span>
                </div>
                <div className="filter-tabs">
                  {(["ALL", ...Object.keys(EX_META)] as (FilterType)[]).map((type) => {
                    const count = type === "ALL"
                      ? summary.exceptionCount
                      : result.exceptions.filter((e) => e.type === type).length;
                    if (type !== "ALL" && count === 0) return null;
                    const meta = type === "ALL" ? null : EX_META[type as ExceptionType];
                    return (
                      <motion.button
                        key={type}
                        className={`filter-tab ${filter === type ? "active" : ""}`}
                        onClick={() => setFilter(type)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        id={`filter-${type.toLowerCase()}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        {type !== "ALL" && meta && (
                          <GlassIcon
                            icon={meta.icon}
                            variant={filter === type ? "dark" : meta.variant}
                            size="sm"
                            style={{ width: 20, height: 20, borderRadius: 4 }}
                          />
                        )}
                        <span>{type === "ALL" ? "All" : meta?.label} ({count})</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {displayed.length === 0 ? (
                <motion.div
                  className="card"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ padding: "var(--sp-10)", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}
                >
                  🎉 No exceptions for this filter
                </motion.div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Order / Ref</th><th>Exception Type</th>
                        <th>Severity</th><th>Amount</th><th>Description</th>
                      </tr>
                    </thead>
                    <AnimatePresence mode="popLayout">
                      <tbody>
                        {displayed.map((ex, i) => <ExceptionRow key={ex.id} ex={ex} index={i} />)}
                      </tbody>
                    </AnimatePresence>
                  </table>
                </div>
              )}
            </motion.div>

            {/* Matched orders */}
            <motion.div variants={sectionVariant}>
              <motion.div
                className="collapsible-header"
                onClick={() => setShowMatched((v) => !v)}
                whileHover={{ scale: 1.005 }}
                whileTap={{ scale: 0.997 }}
                id="matched-toggle"
              >
                <div className="section-title" style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)" }}>
                  <GlassIcon icon={CheckSquare} variant="green" size="sm" />
                  <span>Matched Orders</span>
                  <span className="badge badge-green">{summary.matchedCount}</span>
                </div>
                <motion.span
                  className="collapsible-chevron"
                  animate={{ rotate: showMatched ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 280, damping: 24 }}
                >
                  ▾
                </motion.span>
              </motion.div>

              <AnimatePresence>
                {showMatched && (
                  <motion.div
                    key="matched-table"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4, ease: [0.16,1,0.3,1] }}
                    style={{ overflow: "hidden", marginTop: "var(--sp-3)" }}
                  >
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Order No</th><th>Payment ID</th><th>Match Type</th>
                            <th>Gross</th><th>Fee + Tax</th><th>Net</th><th>Settled At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.matches.map((m, i) => <MatchRow key={m.id} match={m} index={i} />)}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Bottom CTA */}
            <motion.div
              variants={sectionVariant}
              className="card"
              style={{
                marginTop: "var(--sp-12)", padding: "var(--sp-8)", textAlign: "center",
              }}
            >
              <h3 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "var(--sp-2)", letterSpacing: "-0.03em" }}>
                Want this automatically, every day?
              </h3>
              <p className="text-secondary" style={{ fontSize: 14, marginBottom: "var(--sp-5)", maxWidth: 460, margin: "0 auto var(--sp-5)" }}>
                Connect your sales integration API keys and e-commerce stores — fresh reconciliation, daily digest,
                no manual CSV exports.
              </p>
              <div style={{ display: "flex", gap: "var(--sp-3)", justifyContent: "center", flexWrap: "wrap" }}>
                <motion.button
                  className="btn btn-primary"
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  id="get-started-btn"
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                >
                  <GlassIcon icon={Sparkles} variant="dark" size="sm" />
                  <span>Get Started — ₹4,999/month</span>
                </motion.button>
                <motion.button
                  className="btn btn-secondary"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => exportToExcel(result)}
                  id="bottom-export-btn"
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                >
                  <GlassIcon icon={Download} variant="dim" size="sm" style={{ width: 20, height: 20, borderRadius: 4 }} />
                  <span>Download this report</span>
                </motion.button>
              </div>
            </motion.div>

          </motion.div>
        </main>

        <footer className="footer">
          <strong>Refract</strong> · All computation runs in your browser. No data sent to our servers.
        </footer>
      </div>
    </>
  );
}
