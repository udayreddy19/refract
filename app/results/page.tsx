"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
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
import { Check, CheckCircle, AlertTriangle, AlertCircle, Coins, ShieldCheck, HelpCircle, ArrowLeft, Download, Hourglass, Percent, RotateCw, Ghost, Sparkles, CheckSquare, ChevronDown, LogOut, type LucideIcon } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import AuthModal from "@/components/AuthModal";
import SiteFooter from "@/components/SiteFooter";
import CheckoutModal, { readCheckoutPlan, rememberCheckoutPlan, type PlanId } from "@/components/CheckoutModal";
import { EXCEPTION_NEXT_STEPS } from "@/lib/exception-guidance";
import {
  getUserSession,
  getPublicSettings,
  signOutUser,
  saveRun,
  updateRunWorkflow,
  explainException,
  checkRiskAlert,
  type PublicSettings,
  type UserSession,
  type ExceptionExplain,
} from "@/lib/auth";
import {
  loadLocalWorkflow,
  setWorkflowEntry,
  encodePayloadB64,
  type WorkflowMap,
} from "@/lib/workflow";
import type { MatchRules } from "@/lib/engine/matcher";
import { DEFAULT_MATCH_RULES } from "@/lib/engine/matcher";
/* ── Formatting ──────────────────────────────────────────────────────────── */
function fmt(p: number) {
  return "₹" + (p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const EX_META: Record<ExceptionType, { label: string; icon: LucideIcon; severity: string; variant: "default" | "green" | "red" | "yellow" | "blue" | "dim" | "dark" }> = {
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
  icon: LucideIcon; value: string; label: string; color: string;
  index: number; isRupee?: boolean; paise?: number; variant?: "default" | "green" | "red" | "yellow" | "blue" | "dim" | "dark";
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
function ExceptionRow({
  ex,
  index,
  selected,
  workflow,
  onStatus,
  onSelect,
  onExplain,
  explaining,
}: {
  ex: Exception;
  index: number;
  selected: boolean;
  workflow?: { status: string; note?: string; assignee?: string };
  onStatus: (id: string, status: "open" | "fixed" | "ignored" | "assigned") => void;
  onSelect: (id: string) => void;
  onExplain: (ex: Exception) => void;
  explaining: boolean;
}) {
  const meta = EX_META[ex.type] || { label: ex.type, icon: HelpCircle, severity: "low", variant: "dim" as const };
  const status = workflow?.status || "open";
  return (
    <motion.tr
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.16,1,0.3,1] }}
      onClick={() => onSelect(ex.id)}
      className={`ex-row ${selected ? "ex-row-selected" : ""}`}
      style={{ cursor: "pointer", opacity: status === "ignored" ? 0.55 : 1 }}
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
      <td style={{ maxWidth: 240, fontSize: 13, color: "var(--text-secondary)" }}>{ex.description}</td>
      <td onClick={(e) => e.stopPropagation()}>
        <select
          className="ex-status-select"
          value={status}
          onChange={(e) => onStatus(ex.id, e.target.value as "open" | "fixed" | "ignored" | "assigned")}
          aria-label="Exception status"
        >
          <option value="open">Open</option>
          <option value="assigned">Assigned</option>
          <option value="fixed">Fixed</option>
          <option value="ignored">Ignored</option>
        </select>
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={explaining}
          onClick={() => onExplain(ex)}
          style={{ fontSize: 12, padding: "4px 8px" }}
        >
          {explaining ? "…" : "Explain"}
        </button>
      </td>
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
    for (const C of [3, 4, 5]) {
      const cell = ws[XLSX.utils.encode_cell({ c: C, r: R })];
      if (cell) {
        cell.t = 'n';
        cell.z = '"₹"#,##0.00';
      }
    }
  }
}

function exportToExcel(result: ReconResult, exceptionFilter: ExceptionType | "ALL" = "ALL") {
  const wb = XLSX.utils.book_new();
  const filteredExceptions =
    exceptionFilter === "ALL"
      ? result.exceptions
      : result.exceptions.filter((e) => e.type === exceptionFilter);

  const summaryData = [
    ["ReconcileX — Reconciliation Report", ""],
    ["Generated", new Date().toLocaleString("en-IN")],
    ["Exception filter", exceptionFilter === "ALL" ? "All" : (EX_META[exceptionFilter]?.label || exceptionFilter)],
    ["", ""],
    ["SUMMARY", ""],
    ["Total Orders", result.summary.totalOrders],
    ["Matched", result.summary.matchedCount],
    ["Exceptions (all)", result.summary.exceptionCount],
    ["Exceptions (exported)", filteredExceptions.length],
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
    ...filteredExceptions.map((e) => [e.orderNo||e.paymentId||"", EX_META[e.type]?.label||e.type, e.severity, e.amountPaise/100, e.description]),
  ]);
  formatExceptionsSheet(wsExceptions);
  autoFitColumns(wsExceptions);
  XLSX.utils.book_append_sheet(wb, wsExceptions, exceptionFilter === "ALL" ? "Exceptions" : "Filtered Exceptions");

  if (exceptionFilter === "ALL") {
    const wsMatched = XLSX.utils.aoa_to_sheet([
      ["Order No","Payment ID","Match Type","Gross (₹)","Fee+Tax (₹)","Net (₹)","Settled At"],
      ...result.matches.map((m) => [m.orderNo,m.paymentId,m.matchType,m.grossPaise/100,(m.feePaise+m.taxPaise)/100,m.netPaise/100,m.settledAt?.toLocaleDateString("en-IN")||"Pending"]),
    ]);
    formatMatchedSheet(wsMatched);
    autoFitColumns(wsMatched);
    XLSX.utils.book_append_sheet(wb, wsMatched, "Matched Orders");
  }

  const suffix = exceptionFilter === "ALL" ? "full" : exceptionFilter.toLowerCase();
  XLSX.writeFile(wb, `reconcilex_recon_${suffix}_${new Date().toISOString().split("T")[0]}.xlsx`);
}

/* ── Main Results Page ───────────────────────────────────────────────────── */
type FilterType = "ALL" | ExceptionType;

export default function ResultsPage() {
  const router = useRouter();
  const [result,      setResult]      = useState<ReconResult | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState<FilterType>("ALL");
  const [showMatched, setShowMatched] = useState(false);
  const [today]                       = useState(() => new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }));
  const [showCheckout, setShowCheckout] = useState(false);
  const [isPro, setIsPro]               = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [selectedPlan, setSelectedPlan]         = useState<"monthly" | "quarterly" | "annual">("monthly");
  const [user, setUser]                         = useState<UserSession | null>(null);
  const [showAuthModal, setShowAuthModal]       = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [billingSettings, setBillingSettings]   = useState<PublicSettings | null>(null);
  const [missingPayload, setMissingPayload]     = useState(false);
  const [saveMsg, setSaveMsg]                   = useState("");
  const [savingRun, setSavingRun]               = useState(false);
  const [workflow, setWorkflow]                 = useState<WorkflowMap>({});
  const [selectedExId, setSelectedExId]         = useState<string | null>(null);
  const [savedRunId, setSavedRunId]             = useState<string | null>(null);
  const [statusFilter, setStatusFilter]         = useState<"all" | "open" | "fixed" | "ignored">("all");
  const [explain, setExplain]                   = useState<ExceptionExplain | null>(null);
  const [explainExId, setExplainExId]           = useState<string | null>(null);
  const [explaining, setExplaining]             = useState(false);
  const [alertMsg, setAlertMsg]                 = useState("");
  const payloadRef = useRef<unknown>(null);
  const alertedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("signed_in") || params.get("auth_error")) {
          const url = new URL(window.location.href);
          url.searchParams.delete("signed_in");
          url.searchParams.delete("auth_error");
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
        }

        const session = await getUserSession();
        if (session) {
          setUser(session);
          setIsPro(!!session.isPro);
          setPaymentPending(session.paymentStatus === "pending");
          if (session.selectedPlan) setSelectedPlan(session.selectedPlan);
        }
        const settings = await getPublicSettings();
        if (settings) setBillingSettings(settings);
        const remembered = readCheckoutPlan();
        if (remembered) setSelectedPlan(remembered);
        const wantCheckout = params.get("checkout") === "1";
        if (wantCheckout) {
          setShowCheckout(true);
          const url = new URL(window.location.href);
          url.searchParams.delete("checkout");
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
        }
      } catch {}

      try {
        const payloadRaw = sessionStorage.getItem("refract_payload");
        if (!payloadRaw) {
          setLoading(false);
          setMissingPayload(true);
          const remembered = readCheckoutPlan();
          if (remembered) setSelectedPlan(remembered);
          const params = new URLSearchParams(window.location.search);
          if (params.get("checkout") === "1" || remembered) {
            setShowCheckout(true);
          }
          return;
        }
        setMissingPayload(false);

        const payload = JSON.parse(payloadRaw);
        payloadRef.current = payload;
        setWorkflow(loadLocalWorkflow());
        const rules: MatchRules = { ...DEFAULT_MATCH_RULES };
        const liveSettings = await getPublicSettings().catch(() => null);
        if (liveSettings?.matchRules) {
          Object.assign(rules, liveSettings.matchRules);
        }
        if (liveSettings) setBillingSettings(liveSettings);
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
        
        const recon = runRecon(orders, payments, settlementItems, { rules });
        setResult(recon);
        if (!alertedRef.current) {
          alertedRef.current = true;
          void getUserSession().then(async (session) => {
            if (!session) return;
            try {
              const res = await checkRiskAlert({
                label: "Live recon",
                summary: {
                  amountAtRiskPaise: recon.summary.amountAtRiskPaise,
                  exceptionCount: recon.summary.exceptionCount,
                },
              });
              if (res.alert.sent) {
                setAlertMsg(
                  `Risk alert sent (${res.alert.channels.join(", ")}) — threshold ₹${res.settings.thresholdInr}`
                );
              }
            } catch {
              // non-blocking
            }
          });
        }
      } catch {
        setMissingPayload(true);
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [router]);

  // Poll while UTR is under review so Pro unlocks without a full page refresh
  useEffect(() => {
    if (!paymentPending || isPro) return;
    const id = window.setInterval(async () => {
      try {
        const session = await getUserSession();
        if (!session) return;
        setUser(session);
        setIsPro(!!session.isPro);
        setPaymentPending(session.paymentStatus === "pending");
        if (session.selectedPlan) setSelectedPlan(session.selectedPlan);
      } catch {
        // ignore transient network errors
      }
    }, 12000);
    return () => window.clearInterval(id);
  }, [paymentPending, isPro]);

  const requestExport = (scope: "full" | "filtered" = "full") => {
    if (!result) return;
    if (isPro) {
      exportToExcel(result, scope === "filtered" && filter !== "ALL" ? filter : "ALL");
      return;
    }
    rememberCheckoutPlan(selectedPlan);
    setShowCheckout(true);
  };

  const saveCurrentRun = async () => {
    if (!result) return;
    if (!user) {
      setShowAuthModal(true);
      setSaveMsg("Sign in to save this run.");
      return;
    }
    setSavingRun(true);
    setSaveMsg("");
    try {
      const types = Array.from(new Set(result.exceptions.map((e) => e.type))).slice(0, 40);
      const payloadB64 = payloadRef.current ? encodePayloadB64(payloadRef.current) : "";
      const run = await saveRun({
        label: `Recon ${today}`,
        summary: result.summary,
        exceptionTypes: types,
        workflow,
        payloadB64: payloadB64 || undefined,
      });
      setSavedRunId(run.id);
      setSaveMsg(run.hasPayload ? "Run + CSV payload saved." : "Run saved to your account.");
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Could not save run.");
    } finally {
      setSavingRun(false);
    }
  };

  const displayed = (() => {
    if (!result) return [];
    let list = filter === "ALL" ? result.exceptions : result.exceptions.filter((e) => e.type === filter);
    if (statusFilter !== "all") {
      list = list.filter((e) => (workflow[e.id]?.status || "open") === statusFilter);
    }
    return list;
  })();

  const setExStatus = (id: string, status: "open" | "fixed" | "ignored" | "assigned") => {
    setWorkflow((prev) => {
      const next = setWorkflowEntry(prev, id, { status });
      if (savedRunId) {
        void updateRunWorkflow(savedRunId, next).catch(() => undefined);
      }
      return next;
    });
  };

  const runExplain = async (ex: Exception) => {
    setExplaining(true);
    setExplainExId(ex.id);
    setSelectedExId(ex.id);
    try {
      const res = await explainException({
        id: ex.id,
        type: ex.type,
        severity: ex.severity,
        amountPaise: ex.amountPaise,
        description: ex.description,
        orderNo: ex.orderNo,
        paymentId: ex.paymentId,
        settlementId: ex.settlementId,
        diff: ex.diff,
      });
      setExplain(res.explain);
    } catch (err) {
      setExplain({
        summary: err instanceof Error ? err.message : "Could not explain this exception.",
        likelyCauses: [],
        suggestedActions: [],
        source: "rules",
      });
    } finally {
      setExplaining(false);
    }
  };

  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const list = displayed;
      const idx = list.findIndex((x) => x.id === selectedExId);
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = list[Math.min(list.length - 1, Math.max(0, idx + 1))];
        if (next) setSelectedExId(next.id);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = list[Math.max(0, idx <= 0 ? 0 : idx - 1)];
        if (next) setSelectedExId(next.id);
      } else if (e.key === "f" && selectedExId) {
        setExStatus(selectedExId, "fixed");
      } else if (e.key === "i" && selectedExId) {
        setExStatus(selectedExId, "ignored");
      } else if (e.key === "o" && selectedExId) {
        setExStatus(selectedExId, "open");
      } else if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void saveCurrentRun();
      } else if (e.key === "e" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        requestExport("full");
      } else if (e.key >= "1" && e.key <= "6") {
        const types: Array<FilterType> = [
          "ALL",
          "SETTLED_NO_ORDER",
          "PAID_NOT_SETTLED",
          "AMOUNT_MISMATCH",
          "FEE_ANOMALY",
          "SETTLEMENT_OVERDUE",
        ];
        const t = types[Number(e.key) - 1];
        if (t) setFilter(t);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, displayed, selectedExId, savedRunId, workflow, user, isPro]);

  if (loading) {
    return (
      <>
        <div className="page-root">
          <nav className="nav">
            <Link href="/" className="nav-logo">
              <div className="nav-logo-mark">RX</div>ReconcileX
            </Link>
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
  }

  if (missingPayload) {
    return (
      <>
        <div className="page-root marketing-page">
          <nav className="nav">
            <Link href="/" className="nav-logo">
              <div className="nav-logo-mark">RX</div>ReconcileX
            </Link>
          </nav>
          <main className="marketing-main" style={{ textAlign: "center" }}>
            <h1 className="hero-title" style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)" }}>
              No reconciliation loaded
            </h1>
            <p className="hero-subtitle" style={{ marginBottom: 24 }}>
              Run a recon from the home page to see matches and exceptions. You can still upgrade to Pro from pricing without a report.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/#tool" className="btn btn-primary">Run a recon</Link>
              <Link href="/pricing" className="btn btn-secondary">Choose a plan</Link>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCheckout(true)}>
                Open Pro checkout
              </button>
            </div>
          </main>
          <SiteFooter />
        </div>
        <CheckoutModal
          isOpen={showCheckout}
          onClose={() => setShowCheckout(false)}
          initialPlan={selectedPlan}
          returnTo="/results"
          onSubmitted={(session) => {
            if (session) {
              setUser(session);
              setIsPro(!!session.isPro);
              setPaymentPending(session.paymentStatus === "pending");
            }
          }}
        />
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} returnTo="/results" />
      </>
    );
  }

  if (!result) return null;

  const { summary, feeAudit } = result;

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
          <Link href="/" className="nav-logo">
            <div className="nav-logo-mark">RX</div>
            ReconcileX
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
          </Link>
          <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center", position: "relative" }}>
            <span className="text-muted" style={{ fontSize: 12.5 }}>{today}</span>
            {saveMsg && <span className="text-muted" style={{ fontSize: 12 }}>{saveMsg}</span>}
            <ThemeToggle />
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              className="btn btn-secondary btn-sm" onClick={() => router.push("/")} id="new-recon-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <GlassIcon icon={ArrowLeft} variant="dim" size="sm" style={{ width: 20, height: 20, borderRadius: 4 }} />
              <span>New Recon</span>
            </motion.button>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              className="btn btn-secondary btn-sm" onClick={() => void saveCurrentRun()}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              disabled={savingRun}
            >
              <span>{savingRun ? "Saving…" : "Save run"}</span>
            </motion.button>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              className="btn btn-primary btn-sm" onClick={() => requestExport("full")} id="export-excel-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <GlassIcon icon={Download} variant="dark" size="sm" style={{ width: 20, height: 20, borderRadius: 4 }} />
              <span>{isPro ? "Export Excel" : "Export (Pro)"}</span>
            </motion.button>

            {user ? (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "20px",
                    padding: "4px 8px 4px 4px",
                    cursor: "pointer",
                    color: "var(--t-hi)"
                  }}
                  id="user-menu-btn"
                >
                  <div style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "var(--yellow)",
                    color: "#1e1b4b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "11px"
                  }}>
                    {user.avatar}
                  </div>
                  <span style={{ fontSize: "12.5px", fontWeight: 600 }}>{user.name.split(" ")[0]}</span>
                  <ChevronDown size={13} style={{ color: "var(--t-dim)" }} />
                </button>

                <AnimatePresence>
                  {showUserDropdown && (
                    <>
                      {/* Invisible backdrop click handler */}
                      <div
                        onClick={() => setShowUserDropdown(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 90 }}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          position: "absolute",
                          top: "36px",
                          right: 0,
                          background: "var(--g-bg-card)",
                          border: "1px solid var(--g-border)",
                          borderRadius: "12px",
                          boxShadow: "var(--s-glass)",
                          width: "200px",
                          padding: "8px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          zIndex: 100
                        }}
                      >
                        <div style={{ padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: "4px" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--t-hi)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {user.name}
                          </div>
                          <div style={{ fontSize: "10.5px", color: "var(--t-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {user.email}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            await signOutUser();
                            setUser(null);
                            setIsPro(false);
                            setPaymentPending(false);
                            setShowUserDropdown(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            width: "100%",
                            background: "none",
                            border: "none",
                            borderRadius: "6px",
                            padding: "8px",
                            textAlign: "left",
                            cursor: "pointer",
                            color: "#ef4444",
                            fontSize: "12px",
                            fontWeight: 600,
                            transition: "background 0.2s"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                        >
                          <LogOut size={14} />
                          <span>Sign Out</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAuthModal(true)}
                id="sign-in-btn"
              >
                Sign In
              </motion.button>
            )}
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
                <div className="filter-tabs" style={{ marginTop: 8 }}>
                  {(["all", "open", "fixed", "ignored"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`filter-tab ${statusFilter === st ? "active" : ""}`}
                      onClick={() => setStatusFilter(st)}
                    >
                      {st === "all" ? "Any status" : st}
                    </button>
                  ))}
                  <span className="text-muted results-shortcut-hint" style={{ fontSize: 12, alignSelf: "center", marginLeft: 8 }}>
                    Keys: j/k select · f fixed · i ignore · o open · ⌘S save
                  </span>
                </div>
              </div>

              {filter !== "ALL" && EXCEPTION_NEXT_STEPS[filter] && (
                <div className="feature-card" style={{ marginBottom: 14 }}>
                  <h3 style={{ marginTop: 0 }}>{EXCEPTION_NEXT_STEPS[filter].title}</h3>
                  <ol style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--t-mid)", fontSize: 13.5, lineHeight: 1.55 }}>
                    {EXCEPTION_NEXT_STEPS[filter].steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 12 }}
                    onClick={() => requestExport("filtered")}
                  >
                    {isPro ? "Export this filter to Excel" : "Unlock filtered Excel export"}
                  </button>
                </div>
              )}

              {alertMsg && (
                <div className="feature-card" style={{ marginBottom: 12 }}>
                  {alertMsg}
                </div>
              )}

              {explain && (
                <div className="feature-card explain-panel" style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                    <h3 style={{ marginTop: 0 }}>
                      Why this broke{" "}
                      <span style={{ fontSize: 12, color: "var(--t-dim)", fontWeight: 500 }}>
                        ({explain.source === "ai" ? "AI" : "rules"})
                      </span>
                    </h3>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExplain(null)}>
                      Close
                    </button>
                  </div>
                  <p style={{ marginTop: 0 }}>{explain.summary}</p>
                  {explain.likelyCauses?.length > 0 && (
                    <>
                      <strong style={{ fontSize: 13 }}>Likely causes</strong>
                      <ul style={{ marginTop: 6, fontSize: 13.5, color: "var(--t-mid)" }}>
                        {explain.likelyCauses.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {explain.suggestedActions?.length > 0 && (
                    <>
                      <strong style={{ fontSize: 13 }}>Suggested actions</strong>
                      <ul style={{ marginTop: 6, fontSize: 13.5, color: "var(--t-mid)" }}>
                        {explain.suggestedActions.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

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
                        <th>Severity</th><th>Amount</th><th>Description</th><th>Status</th><th>AI</th>
                      </tr>
                    </thead>
                    <AnimatePresence mode="popLayout">
                      <tbody>
                        {displayed.map((ex, i) => (
                          <ExceptionRow
                            key={ex.id}
                            ex={ex}
                            index={i}
                            selected={selectedExId === ex.id}
                            workflow={workflow[ex.id]}
                            onStatus={setExStatus}
                            onSelect={setSelectedExId}
                            onExplain={(row) => void runExplain(row)}
                            explaining={explaining && explainExId === ex.id}
                          />
                        ))}
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
                    ReconcileX Pro is active
                  </h3>
                  <p className="text-secondary" style={{ fontSize: 14, marginBottom: "var(--sp-5)", maxWidth: 460, margin: "0 auto var(--sp-5)" }}>
                    Your account has Pro access. Plan:{" "}
                    <strong style={{ color: "var(--t-hi)" }}>
                      {user?.selectedPlan || "Pro"}
                    </strong>
                    {user?.utrValue ? (
                      <> · UTR <strong style={{ color: "var(--t-hi)" }}>{user.utrValue}</strong></>
                    ) : null}
                  </p>
                </>
              ) : paymentPending ? (
                <>
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "var(--sp-2)", letterSpacing: "-0.03em" }}>
                    Payment under review
                  </h3>
                  <p className="text-secondary" style={{ fontSize: 14, marginBottom: "var(--sp-6)", maxWidth: 460, margin: "0 auto var(--sp-6)" }}>
                    Your UTR was submitted. An admin will verify the payment and activate Pro on your account.
                  </p>
                </>
              ) : (
                <>
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "var(--sp-2)", letterSpacing: "-0.03em" }}>
                    Want this automatically, every day?
                  </h3>
                  <p className="text-secondary" style={{ fontSize: 14, marginBottom: "var(--sp-6)", maxWidth: 460, margin: "0 auto var(--sp-6)" }}>
                    Unlock Pro for full Excel exports and priority support — pay via UPI and an admin activates your account.
                  </p>

                  {/* Modern Flat Plan Selector */}
                  <div style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "12px",
                    maxWidth: "600px",
                    margin: "0 auto var(--sp-6)",
                    flexWrap: "wrap"
                  }}>
                    {[
                      {
                        id: "monthly",
                        label: "Monthly",
                        price: `₹${(billingSettings?.plans?.monthly?.amount ?? 4999).toLocaleString("en-IN")}/mo`,
                        detail: "Billed Monthly",
                        savings: "",
                      },
                      {
                        id: "quarterly",
                        label: "Quarterly",
                        price: `₹${(billingSettings?.plans?.quarterly?.amount ?? 9999).toLocaleString("en-IN")}/qtr`,
                        detail: "Billed Quarterly",
                        savings: "Save more",
                      },
                      {
                        id: "annual",
                        label: "Annual Plan",
                        price: `₹${(billingSettings?.plans?.annual?.amount ?? 29999).toLocaleString("en-IN")}/yr`,
                        detail: "Billed Yearly",
                        savings: "Best value",
                      },
                    ].map((plan) => {
                      const isSelected = selectedPlan === plan.id;
                      return (
                        <button
                          type="button"
                          key={plan.id}
                          onClick={() => {
                            const id = plan.id as PlanId;
                            setSelectedPlan(id);
                            rememberCheckoutPlan(id);
                          }}
                          style={{
                            flex: "1 1 160px",
                            background: isSelected ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                            border: isSelected ? "1.5px solid var(--yellow)" : "1px solid var(--g-border)",
                            borderRadius: "14px",
                            padding: "12px 14px",
                            cursor: "pointer",
                            textAlign: "center",
                            position: "relative",
                            transition: "all 0.2s ease"
                          }}
                        >
                          {plan.savings && (
                            <span style={{
                              position: "absolute",
                              top: "-9px",
                              left: "50%",
                              transform: "translateX(-50%)",
                              background: "linear-gradient(135deg, #10B981, #059669)",
                              color: "#fff",
                              fontSize: "9px",
                              fontWeight: 800,
                              padding: "1px 6px",
                              borderRadius: "99px",
                              textTransform: "uppercase",
                              letterSpacing: "0.03em"
                            }}>
                              {plan.savings}
                            </span>
                          )}
                          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: isSelected ? "var(--t-hi)" : "var(--t-mid)", letterSpacing: "0.05em", marginBottom: "4px" }}>
                            {plan.label}
                          </div>
                          <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--t-hi)", letterSpacing: "-0.02em" }}>
                            {plan.price}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--t-dim)", marginTop: "2px" }}>
                            {plan.detail}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", gap: "var(--sp-3)", justifyContent: "center", flexWrap: "wrap" }}>
                    <motion.button
                      className="btn btn-primary"
                      whileHover={{ scale: 1.04, y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      id="get-started-btn"
                      onClick={() => {
                        rememberCheckoutPlan(selectedPlan);
                        setShowCheckout(true);
                      }}
                      style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                    >
                      <GlassIcon icon={Sparkles} variant="dark" size="sm" />
                      <span>
                        {selectedPlan === "monthly"
                          ? `Get Started — ₹${(billingSettings?.plans?.monthly?.amount ?? 4999).toLocaleString("en-IN")}/month`
                          : selectedPlan === "quarterly"
                            ? `Get Started — ₹${(billingSettings?.plans?.quarterly?.amount ?? 9999).toLocaleString("en-IN")}/quarter`
                            : `Get Started — ₹${(billingSettings?.plans?.annual?.amount ?? 29999).toLocaleString("en-IN")}/year`}
                      </span>
                    </motion.button>
                    <motion.button
                      className="btn btn-secondary"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => requestExport("full")}
                      id="bottom-export-btn"
                      style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                    >
                      <GlassIcon icon={Download} variant="dim" size="sm" style={{ width: 20, height: 20, borderRadius: 4 }} />
                      <span>{isPro ? "Download this report" : "Unlock Excel export"}</span>
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>

          </motion.div>
        </main>

        <SiteFooter />
      </div>

      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        initialPlan={selectedPlan}
        returnTo="/results"
        onSubmitted={(session) => {
          if (session) {
            setUser(session);
            setIsPro(!!session.isPro);
            setPaymentPending(session.paymentStatus === "pending");
            if (session.selectedPlan) setSelectedPlan(session.selectedPlan);
          }
        }}
      />

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} returnTo="/results" />
    </>
  );
}
