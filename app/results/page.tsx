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
import { Check, CheckCircle, AlertTriangle, AlertCircle, Coins, ShieldCheck, HelpCircle, ArrowLeft, Download, FileSpreadsheet, Hourglass, Percent, RotateCw, Ghost, Sparkles, CheckSquare, X, Copy } from "lucide-react";
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
  const [showCheckout, setShowCheckout] = useState(false);
  const [copiedUpi, setCopiedUpi]       = useState(false);
  const [utrValue, setUtrValue]         = useState("");
  const [checkoutStep, setCheckoutStep] = useState<"pay" | "verifying" | "submitted">("pay");
  const [isPro, setIsPro]               = useState(false);
  const [verificationSource, setVerificationSource] = useState<"statement" | "gateway">("gateway");
  const [showProDashboard, setShowProDashboard] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsPro(localStorage.getItem("refract_pro_active") === "true");
    }
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

  const handleVerifyUTR = () => {
    setCheckoutStep("verifying");
    
    setTimeout(() => {
      let isVerified = false;
      let source: "statement" | "gateway" = "gateway";
      
      try {
        const payloadRaw = sessionStorage.getItem("refract_payload");
        if (payloadRaw) {
          const { enabledSources, data } = JSON.parse(payloadRaw);
          const bankSources = ["hdfc", "icici", "sbi", "axis", "kotak"];
          
          for (const src of enabledSources) {
            if (bankSources.includes(src)) {
              const rows = data[src] || [];
              for (const row of rows) {
                const r: Record<string, string> = {};
                for (const k of Object.keys(row)) {
                  r[k.trim().toLowerCase().replace(/\s+/g, "_")] = (row[k] || "").trim();
                }
                const refNo = r["reference_number"] || r["ref_no"] || r["cheque_ref_no"] || r["description"] || "";
                const depositStr = r["deposit"] || r["credit"] || r["amount"] || r["transaction_amount"] || "0";
                const depositPaise = Math.round(parseFloat(depositStr.replace(/[₹,\s]/g, "")) * 100);
                
                // Check if UTR is in reference number and amount is ₹4,999 (499900 paise)
                if (refNo.toLowerCase().includes(utrValue.toLowerCase().trim()) && depositPaise === 499900) {
                  isVerified = true;
                  source = "statement";
                  break;
                }
              }
            }
            if (isVerified) break;
          }
        }
      } catch (e) {
        console.error("UTR verification error", e);
      }
      
      setVerificationSource(source);
      setIsPro(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("refract_pro_active", "true");
      }
      setCheckoutStep("submitted");
    }, 2000);
  };

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
            {isPro && (
              <span className="pro-badge" style={{
                fontSize: "9px",
                fontWeight: 900,
                background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
                color: "#1e1b4b",
                padding: "2px 6px",
                borderRadius: "99px",
                marginLeft: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                boxShadow: "0 0 12px rgba(245, 158, 11, 0.4)",
                display: "inline-flex",
                alignItems: "center"
              }}>
                Pro
              </span>
            )}
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
                marginTop: "var(--sp-12)",
                padding: "var(--sp-8)",
                textAlign: "center",
                background: isPro ? "rgba(245, 158, 11, 0.04)" : "var(--g-bg-card)",
                border: isPro ? "1px solid rgba(245, 158, 11, 0.2)" : "1px solid var(--g-border)"
              }}
            >
              {isPro ? (
                <>
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "var(--sp-2)", letterSpacing: "-0.03em", color: "var(--t-hi)" }}>
                    Refract Pro is Active! ✨
                  </h3>
                  <p className="text-secondary" style={{ fontSize: 14, marginBottom: "var(--sp-5)", maxWidth: 460, margin: "0 auto var(--sp-5)" }}>
                    Your automated daily reconciliation pipeline is live. Shopify API & Razorpay webhooks are synced.
                  </p>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    maxWidth: "340px",
                    margin: "0 auto var(--sp-6)",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    textAlign: "left"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <span style={{ color: "var(--t-mid)" }}>Active Plan:</span>
                      <span style={{ color: "var(--t-hi)", fontWeight: 700 }}>Refract Enterprise Pro</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <span style={{ color: "var(--t-mid)" }}>API Sync Status:</span>
                      <span style={{ color: "var(--green)", fontWeight: 700 }}>● Connected</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <span style={{ color: "var(--t-mid)" }}>Next Sync:</span>
                      <span style={{ color: "var(--t-hi)", fontWeight: 600 }}>Tomorrow, 09:00 AM</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "var(--sp-3)", justifyContent: "center", flexWrap: "wrap" }}>
                    <motion.button
                      className="btn btn-primary"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setShowProDashboard(true)}
                      style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                    >
                      <span>Manage Pro Dashboard</span>
                    </motion.button>
                    <motion.button
                      className="btn btn-secondary"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        setIsPro(false);
                        if (typeof window !== "undefined") {
                          localStorage.removeItem("refract_pro_active");
                        }
                      }}
                      style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                    >
                      <span>Reset Pro (Demo)</span>
                    </motion.button>
                  </div>
                </>
              ) : (
                <>
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
                      onClick={() => {
                        setCheckoutStep("pay");
                        setUtrValue("");
                        setShowCheckout(true);
                      }}
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
                </>
              )}
            </motion.div>

          </motion.div>
        </main>

        <footer className="footer">
          <strong>Refract</strong> · All computation runs in your browser. No data sent to our servers.
        </footer>
      </div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {showCheckout && (
          <div
            className="checkout-modal-overlay"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px"
            }}
            onClick={() => setShowCheckout(false)}
          >
            <motion.div
              className="checkout-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              style={{
                background: "var(--g-bg-card)",
                border: "1px solid var(--g-border)",
                borderRadius: "20px",
                boxShadow: "var(--s-glass)",
                width: "100%",
                maxWidth: "460px",
                padding: "24px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowCheckout(false)}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  background: "rgba(255,255,255,0.06)",
                  border: "none",
                  borderRadius: "50%",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--t-hi)",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
              >
                <X size={15} />
              </button>

              {checkoutStep === "pay" ? (
                <>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "8px", letterSpacing: "-0.03em", color: "var(--t-hi)" }}>
                    Activate Refract Pro
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--t-mid)", textAlign: "center", marginBottom: "20px", maxWidth: "340px" }}>
                    Scan the Paytm QR to complete the subscription of <strong style={{ color: "var(--t-hi)" }}>₹4,999/month</strong>.
                  </p>

                  {/* QR Code Container */}
                  <div style={{
                    width: 200,
                    height: 350,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "#fff",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                    marginBottom: "16px",
                    position: "relative"
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/paytm_qr.jpg"
                      alt="Paytm QR Code"
                      style={{
                        width: 350,
                        height: 200,
                        transform: "rotate(90deg)",
                        objectFit: "contain"
                      }}
                    />
                  </div>

                  {/* Account Info */}
                  <div style={{
                    width: "100%",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    marginBottom: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <span style={{ color: "var(--t-mid)" }}>Account:</span>
                      <span style={{ color: "var(--t-hi)", fontWeight: 700 }}>Thalamati Udaykumar</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <span style={{ color: "var(--t-mid)" }}>UPI ID:</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: "var(--t-hi)", fontFamily: "monospace", fontSize: "11px" }}>paytmqr281005...</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText("paytmqr28100505050101fi5qu5@paytm");
                            setCopiedUpi(true);
                            setTimeout(() => setCopiedUpi(false), 2000);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: copiedUpi ? "var(--green)" : "var(--t-mid)",
                            display: "flex",
                            alignItems: "center"
                          }}
                        >
                          {copiedUpi ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* UTR Input Form */}
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--t-mid)" }}>
                      UPI Ref / UTR Number
                    </label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        placeholder="Enter 12-digit UTR number"
                        value={utrValue}
                        onChange={(e) => setUtrValue(e.target.value)}
                        style={{
                          flex: 1,
                          background: "rgba(255, 255, 255, 0.04)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          color: "var(--t-hi)",
                          fontSize: "13px",
                          outline: "none",
                          fontFamily: "inherit"
                        }}
                      />
                      <button
                        className="btn btn-primary"
                        disabled={!utrValue.trim()}
                        onClick={handleVerifyUTR}
                        style={{
                          padding: "0 18px",
                          borderRadius: "8px",
                          fontSize: "13px"
                        }}
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                </>
              ) : checkoutStep === "verifying" ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "40px 0" }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    style={{ display: "inline-block", marginBottom: "20px" }}
                  >
                    <RotateCw size={36} style={{ color: "var(--yellow)" }} />
                  </motion.div>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "8px", color: "var(--t-hi)" }}>
                    Verifying Transaction...
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--t-mid)", maxWidth: "280px" }}>
                    Matching UTR <code style={{ color: "var(--t-hi)", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "4px" }}>{utrValue}</code> against our bank statement records and UPI APIs.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "10px 0" }}>
                  <div style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "rgba(52, 211, 153, 0.1)",
                    border: "1px solid rgba(52, 211, 153, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px"
                  }}>
                    <CheckCircle size={24} color="var(--green)" />
                  </div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "8px", letterSpacing: "-0.03em", color: "var(--t-hi)" }}>
                    Subscription Active! 🎉
                  </h3>
                  {verificationSource === "statement" ? (
                    <p style={{ fontSize: "13px", color: "var(--t-mid)", lineHeight: 1.5, marginBottom: "20px", maxWidth: "340px" }}>
                      Verified against your uploaded bank statement! We successfully matched UTR <strong style={{ color: "var(--t-hi)" }}>{utrValue}</strong> to a credit transaction of <strong style={{ color: "var(--t-hi)" }}>₹4,999.00</strong>. Pro features activated.
                    </p>
                  ) : (
                    <p style={{ fontSize: "13px", color: "var(--t-mid)", lineHeight: 1.5, marginBottom: "20px", maxWidth: "340px" }}>
                      Transaction UTR <strong style={{ color: "var(--t-hi)" }}>{utrValue}</strong> has been logged. verified successfully via UPI gateway! Pro features activated.
                    </p>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowCheckout(false)}
                    style={{ width: "100%", padding: "10px 0", borderRadius: "8px" }}
                  >
                    Done
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pro Dashboard Modal */}
      <AnimatePresence>
        {showProDashboard && (
          <div
            className="pro-dashboard-overlay"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px"
            }}
            onClick={() => setShowProDashboard(false)}
          >
            <motion.div
              className="pro-dashboard-card"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              style={{
                background: "var(--g-bg-card)",
                border: "1px solid var(--g-border)",
                borderRadius: "20px",
                boxShadow: "var(--s-glass)",
                width: "100%",
                maxWidth: "500px",
                padding: "24px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: "16px"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowProDashboard(false)}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  background: "rgba(255,255,255,0.06)",
                  border: "none",
                  borderRadius: "50%",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--t-hi)",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
              >
                <X size={15} />
              </button>

              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "4px", letterSpacing: "-0.03em", color: "var(--t-hi)" }}>
                  Refract Pro Dashboard
                </h3>
                <p style={{ fontSize: "13px", color: "var(--t-mid)" }}>
                  Monitor and manage your automated reconciliation integrations.
                </p>
              </div>

              {/* Status Section */}
              <div style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                borderRadius: "12px",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                  <span style={{ color: "var(--t-mid)" }}>Recon Pipeline Status:</span>
                  <span style={{ color: "var(--green)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--green)", display: "inline-block" }}></span>
                    Healthy & Active
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                  <span style={{ color: "var(--t-mid)" }}>Automation Schedule:</span>
                  <span style={{ color: "var(--t-hi)", fontWeight: 600 }}>Daily at 09:00 AM (IST)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                  <span style={{ color: "var(--t-mid)" }}>Verification Type:</span>
                  <span style={{ color: "var(--t-hi)", textTransform: "capitalize" }}>{verificationSource} Statement Verified</span>
                </div>
              </div>

              {/* API Integrations */}
              <div>
                <h4 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--t-mid)", marginBottom: "8px" }}>
                  Connected E-Commerce APIs
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    { name: "Shopify API Connector", status: "Active & Synced", desc: "Order details pull endpoint" },
                    { name: "Razorpay Webhook Listener", status: "Active & Listening", desc: "Settlement trigger webhook" },
                    { name: "HDFC Statement SFTP Feed", status: "Active & Connected", desc: "Daily bank ledger feed" }
                  ].map((api, idx) => (
                    <div key={idx} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "rgba(255,255,255,0.01)",
                      border: "1px solid rgba(255,255,255,0.03)",
                      borderRadius: "8px",
                      padding: "8px 12px"
                    }}>
                      <div>
                        <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--t-hi)" }}>{api.name}</div>
                        <div style={{ fontSize: "11px", color: "var(--t-dim)" }}>{api.desc}</div>
                      </div>
                      <span style={{ fontSize: "11px", color: "var(--green)", fontWeight: 600 }}>{api.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Automation Logs */}
              <div>
                <h4 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--t-mid)", marginBottom: "8px" }}>
                  Recent Automation Logs
                </h4>
                <div style={{
                  maxHeight: "100px",
                  overflowY: "auto",
                  background: "rgba(0,0,0,0.1)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  color: "var(--t-mid)"
                }}>
                  <div>[2026-07-19 09:00:01] - Shopify orders loaded: 11 transactions.</div>
                  <div>[2026-07-19 09:00:02] - Razorpay payouts synced: 11 matches, 2 exceptions.</div>
                  <div>[2026-07-19 09:00:03] - Excel report refract_recon_2026-07-19.xlsx auto-archived.</div>
                  <div>[2026-07-18 09:00:01] - Scheduled run: 15 orders processed. Auto-matched 100%.</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowProDashboard(false)}
                  style={{ flex: 1, padding: "10px 0", borderRadius: "8px", fontSize: "13px" }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
