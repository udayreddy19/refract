"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from "framer-motion";
import GlassIcon from "@/components/GlassIcon";

import {
  Check,
  X,
  CreditCard,
  ShoppingBag,
  Zap,
  CheckCircle,
  AlertTriangle,
  Percent,
  FileSpreadsheet,
  Truck,
  Store,
  Smartphone,
  Globe,
  Package,
  Landmark,
  BookOpen,
  Megaphone,
  Wallet,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import AuthModal from "@/components/AuthModal";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import ColumnMapper from "@/components/ColumnMapper";
import {
  getUserSession,
  type UserSession,
} from "@/lib/auth";
import {
  loadChannelPreset,
  saveChannelPreset,
  loadColumnMap,
  saveColumnMap,
  EXPECTED_FIELDS,
  autoMapHeaders,
  applyColumnMap,
  missingExpected,
} from "@/lib/presets";

/* ── variants ──────────────────────────────────────────────────────────── */

const fadeUp = {
  hidden:  { opacity: 0, y: 24, filter: "blur(8px)" },
  visible: (i = 0) => ({
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

/* ── Magnetic button (follows cursor) ─────────────────────────────────── */
function MagneticButton({ children, className, disabled, onClick, id }: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  id?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 18 });
  const sy = useSpring(y, { stiffness: 200, damping: 18 });

  const handleMove = (e: React.MouseEvent) => {
    if (!ref.current || disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * 0.22);
    y.set((e.clientY - cy) * 0.22);
  };

  const handleLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.button
      ref={ref}
      id={id}
      className={className}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={onClick}
      disabled={disabled}
      style={{ x: sx, y: sy }}
      whileTap={disabled ? {} : { scale: 0.96 }}
    >
      {children}
    </motion.button>
  );
}

type SourceType =
  /* Platforms */
  | "shopify" | "woocommerce" | "magento" | "bigcommerce" | "dukaan" | "fynd" | "shopware" | "prestashop"
  /* Gateways */
  | "razorpay" | "stripe" | "cashfree" | "payu" | "phonepe" | "paytm" | "instamojo" | "ccavenue" | "juspay" | "billdesk" | "easebuzz" | "pinelabs" | "paypal" | "gpay"
  /* Shipping */
  | "shiprocket" | "delhivery" | "ecomexpress" | "bluedart" | "dtdc" | "xpressbees" | "shadowfax"
  /* Marketplaces */
  | "amazon" | "flipkart" | "meesho" | "myntra" | "nykaa" | "ajio" | "jiomart" | "tatacliq" | "snapdeal" | "firstcry" | "purplle" | "pepperfry" | "limeroad"
  /* Banks */
  | "hdfc" | "icici" | "sbi" | "axis" | "kotak"
  /* Accounting */
  | "tally" | "zohobooks" | "quickbooks"
  /* Ads */
  | "googleads" | "metaads";

type FileState = {
  file: File | null;
  rows: Record<string, string>[];
  name: string;
};

const SOURCE_META: Record<SourceType, {
  label: string;
  category: "platform" | "gateway" | "shipping" | "marketplace" | "bank" | "accounting" | "ads";
  icon: LucideIcon;
  hint: string;
  variant: "default" | "green" | "red" | "yellow" | "blue" | "dim" | "dark";
}> = {
  /* ── Platforms ── */
  shopify:      { label: "Shopify",       category: "platform", icon: ShoppingBag,    hint: "Shopify Admin → Orders → Export",              variant: "green"   },
  woocommerce:  { label: "WooCommerce",   category: "platform", icon: Globe,          hint: "WooCommerce → Orders → Export",               variant: "blue"    },
  magento:      { label: "Magento",       category: "platform", icon: Store,          hint: "Magento Admin → Sales → Orders → Export",     variant: "red"     },
  bigcommerce:  { label: "BigCommerce",   category: "platform", icon: Store,          hint: "BigCommerce → Orders → Export",               variant: "default" },
  dukaan:       { label: "Dukaan",        category: "platform", icon: Store,          hint: "Dukaan Dashboard → Orders → Export",          variant: "blue"    },
  fynd:         { label: "Fynd",          category: "platform", icon: ShoppingBag,    hint: "Fynd Platform → Orders → Export",             variant: "yellow"  },
  shopware:     { label: "Shopware",      category: "platform", icon: Globe,          hint: "Shopware Admin → Orders → Export",            variant: "blue"    },
  prestashop:   { label: "PrestaShop",    category: "platform", icon: Globe,          hint: "PrestaShop → Orders → Export",                variant: "green"   },

  /* ── Payment Gateways ── */
  razorpay:     { label: "Razorpay",      category: "gateway",  icon: CreditCard,     hint: "Razorpay → Settlements → Export",             variant: "blue"    },
  stripe:       { label: "Stripe",        category: "gateway",  icon: CreditCard,     hint: "Stripe → Payouts → Export",                   variant: "yellow"  },
  cashfree:     { label: "Cashfree",      category: "gateway",  icon: CreditCard,     hint: "Cashfree → Settlements → Export",             variant: "green"   },
  payu:         { label: "PayU",          category: "gateway",  icon: CreditCard,     hint: "PayU → Settlements → Export",                 variant: "default" },
  phonepe:      { label: "PhonePe",       category: "gateway",  icon: Smartphone,     hint: "PhonePe Business → Settlements → Export",     variant: "default" },
  paytm:        { label: "Paytm",         category: "gateway",  icon: Smartphone,     hint: "Paytm Business → Settlements → Export",       variant: "blue"    },
  instamojo:    { label: "Instamojo",     category: "gateway",  icon: Zap,            hint: "Instamojo → Payments → Export",               variant: "yellow"  },
  ccavenue:     { label: "CCAvenue",      category: "gateway",  icon: CreditCard,     hint: "CCAvenue → Reports → Settlements",            variant: "red"     },
  juspay:       { label: "Juspay",        category: "gateway",  icon: CreditCard,     hint: "Juspay Dashboard → Settlements → Export",     variant: "blue"    },
  billdesk:     { label: "BillDesk",      category: "gateway",  icon: CreditCard,     hint: "BillDesk → Settlement Reports → Export",      variant: "default" },
  easebuzz:     { label: "Easebuzz",      category: "gateway",  icon: Wallet,         hint: "Easebuzz → Settlements → Export",             variant: "green"   },
  pinelabs:     { label: "Pine Labs",     category: "gateway",  icon: CreditCard,     hint: "Plural → Settlements → Export",               variant: "yellow"  },
  paypal:       { label: "PayPal",        category: "gateway",  icon: Wallet,         hint: "PayPal → Activity → Download",                variant: "blue"    },
  gpay:         { label: "Google Pay",    category: "gateway",  icon: Smartphone,     hint: "Google Pay Business → Transactions → Export", variant: "green"   },

  /* ── Shipping / Logistics ── */
  shiprocket:   { label: "Shiprocket",    category: "shipping", icon: Package,        hint: "Shiprocket → Remittances → Export",           variant: "yellow"  },
  delhivery:    { label: "Delhivery",     category: "shipping", icon: Truck,          hint: "Delhivery → COD Remittance → Export",         variant: "red"     },
  ecomexpress:  { label: "Ecom Express",  category: "shipping", icon: Truck,          hint: "Ecom Express → COD Reports → Export",         variant: "blue"    },
  bluedart:     { label: "BlueDart",      category: "shipping", icon: Package,        hint: "BlueDart → COD Remittance → Export",          variant: "blue"    },
  dtdc:         { label: "DTDC",          category: "shipping", icon: Truck,          hint: "DTDC → COD Reports → Export",                 variant: "red"     },
  xpressbees:   { label: "Xpressbees",   category: "shipping", icon: Package,        hint: "Xpressbees → COD Remittance → Export",        variant: "yellow"  },
  shadowfax:    { label: "Shadowfax",     category: "shipping", icon: Truck,          hint: "Shadowfax → COD Reports → Export",            variant: "default" },

  /* ── Marketplaces ── */
  amazon:       { label: "Amazon",        category: "marketplace", icon: FileSpreadsheet, hint: "Seller Central → Settlements",             variant: "yellow"  },
  flipkart:     { label: "Flipkart",      category: "marketplace", icon: FileSpreadsheet, hint: "Seller Hub → Settlements",                 variant: "blue"    },
  meesho:       { label: "Meesho",        category: "marketplace", icon: ShoppingBag,     hint: "Meesho Supplier → Payments → Export",      variant: "default" },
  myntra:       { label: "Myntra",        category: "marketplace", icon: ShoppingBag,     hint: "Myntra Partner Portal → Settlements",      variant: "green"   },
  nykaa:        { label: "Nykaa",         category: "marketplace", icon: Store,           hint: "Nykaa Seller Portal → Settlements",        variant: "red"     },
  ajio:         { label: "Ajio",          category: "marketplace", icon: ShoppingBag,     hint: "Ajio Seller Portal → Settlements",         variant: "yellow"  },
  jiomart:      { label: "JioMart",       category: "marketplace", icon: Store,           hint: "JioMart Seller → Settlements → Export",    variant: "blue"    },
  tatacliq:     { label: "Tata Cliq",     category: "marketplace", icon: Store,           hint: "Tata Cliq Seller → Settlements",           variant: "default" },
  snapdeal:     { label: "Snapdeal",      category: "marketplace", icon: ShoppingBag,     hint: "Snapdeal Seller → Payments → Export",      variant: "red"     },
  firstcry:     { label: "FirstCry",      category: "marketplace", icon: ShoppingBag,     hint: "FirstCry Seller → Settlements → Export",   variant: "green"   },
  purplle:      { label: "Purplle",       category: "marketplace", icon: Store,           hint: "Purplle Seller → Settlements → Export",    variant: "red"     },
  pepperfry:    { label: "Pepperfry",     category: "marketplace", icon: Store,           hint: "Pepperfry Seller → Settlements → Export",  variant: "yellow"  },
  limeroad:     { label: "Limeroad",      category: "marketplace", icon: ShoppingBag,     hint: "Limeroad Seller → Payments → Export",      variant: "green"   },

  /* ── Bank Statements ── */
  hdfc:         { label: "HDFC Bank",     category: "bank",     icon: Landmark,       hint: "NetBanking → Account Statement → Download CSV", variant: "blue"  },
  icici:        { label: "ICICI Bank",    category: "bank",     icon: Landmark,       hint: "iMobile → Statement → Export CSV",               variant: "red"   },
  sbi:          { label: "SBI",           category: "bank",     icon: Landmark,       hint: "OnlineSBI → Account Statement → Download",      variant: "blue"  },
  axis:         { label: "Axis Bank",     category: "bank",     icon: Landmark,       hint: "Internet Banking → Statement → Export",          variant: "default" },
  kotak:        { label: "Kotak",         category: "bank",     icon: Landmark,       hint: "NetBanking → Statement → Download CSV",          variant: "red"   },

  /* ── Accounting ── */
  tally:        { label: "Tally",         category: "accounting", icon: BookOpen,      hint: "Tally → Gateway of Tally → Export",              variant: "default" },
  zohobooks:    { label: "Zoho Books",    category: "accounting", icon: BookOpen,      hint: "Zoho Books → Reports → Export",                  variant: "yellow"  },
  quickbooks:   { label: "QuickBooks",    category: "accounting", icon: BookOpen,      hint: "QuickBooks → Reports → Export",                  variant: "green"   },

  /* ── Ad Platforms ── */
  googleads:    { label: "Google Ads",    category: "ads",      icon: BarChart3,      hint: "Google Ads → Reports → Billing → Download",     variant: "blue"    },
  metaads:      { label: "Meta Ads",      category: "ads",      icon: Megaphone,      hint: "Meta Business Suite → Billing → Export",         variant: "blue"    },
};

const ALL_SOURCES = Object.keys(SOURCE_META) as SourceType[];

const initFileState = (): Record<SourceType, FileState> =>
  ALL_SOURCES.reduce((acc, src) => {
    acc[src] = { file: null, rows: [], name: "" };
    return acc;
  }, {} as Record<SourceType, FileState>);

const initDragState = (): Record<SourceType, boolean> =>
  ALL_SOURCES.reduce((acc, src) => {
    acc[src] = false;
    return acc;
  }, {} as Record<SourceType, boolean>);

const CATEGORIES = [
  { key: "platform" as const,    label: "Platforms",             icon: Store },
  { key: "gateway" as const,     label: "Gateways",              icon: CreditCard },
  { key: "shipping" as const,    label: "Shipping",              icon: Truck },
  { key: "marketplace" as const, label: "Marketplaces",          icon: ShoppingBag },
  { key: "bank" as const,        label: "Banks",                 icon: Landmark },
  { key: "accounting" as const,  label: "Accounting",            icon: BookOpen },
  { key: "ads" as const,         label: "Ads",                   icon: Megaphone },
];

type CategoryKey = typeof CATEGORIES[number]["key"];

/* ── Main Page ─────────────────────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter();
  const [enabledSources, setEnabledSources] = useState<SourceType[]>(() =>
    loadChannelPreset<SourceType>([])
  );
  const [mapper, setMapper] = useState<null | {
    target: SourceType;
    file: File;
    headers: string[];
    rows: Record<string, string>[];
    expected: string[];
    initialMap: Record<string, string>;
  }>(null);
  const [files, setFiles] = useState<Record<SourceType, FileState>>(initFileState);
  const [dragging, setDragging] = useState<Record<SourceType, boolean>>(initDragState);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("platform");

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [user, setUser] = useState<UserSession | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    saveChannelPreset(enabledSources);
  }, [enabledSources]);

  // Restore session from ServerByt PHP cookie; resume recon after Google OAuth
  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const authError = params.get("auth_error");
        const signedIn = params.get("signed_in");

        if (authError || signedIn) {
          const url = new URL(window.location.href);
          url.searchParams.delete("auth_error");
          url.searchParams.delete("signed_in");
          window.history.replaceState({}, "", url.pathname + url.search + url.hash);
        }

        if (authError) {
          setError(decodeURIComponent(authError));
        }

        const session = await getUserSession();
        if (cancelled) return;
        setUser(session);

        if (signedIn && session && sessionStorage.getItem("refract_pending_recon") === "1") {
          sessionStorage.removeItem("refract_pending_recon");
          if (sessionStorage.getItem("refract_payload")) {
            router.push("/results");
          }
        }
      } catch {
        if (!cancelled) setUser(null);
      }
    };

    const timer = setTimeout(() => {
      void loadSession();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [router]);

  /* Dynamic ref map — one ref per source, created on demand */
  const inputRefs = useRef<Map<SourceType, HTMLInputElement | null>>(new Map());
  const setInputRef = (source: SourceType) => (el: HTMLInputElement | null) => {
    inputRefs.current.set(source, el);
  };

  const toggleSource = (source: SourceType) => {
    setEnabledSources((prev) => {
      if (prev.includes(source)) {
        setFiles((f) => ({ ...f, [source]: { file: null, rows: [], name: "" } }));
        return prev.filter((s) => s !== source);
      } else {
        return [...prev, source];
      }
    });
  };

  const parseCSV = (file: File): Promise<Record<string, string>[]> =>
    new Promise((res, rej) =>
      Papa.parse<Record<string, string>>(file, {
        header: true, skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: (r) => res(r.data),
        error: (e) => rej(e),
      })
    );

  const commitRows = useCallback((target: SourceType, file: File, rows: Record<string, string>[]) => {
    setFiles((f) => ({ ...f, [target]: { file, rows, name: file.name } }));
  }, []);

  const handleFile = useCallback(async (file: File, target: SourceType) => {
    if (!file.name.endsWith(".csv")) { setError("Please upload a CSV file."); return; }
    setError(null);
    try {
      const rows = await parseCSV(file);
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      const expected = EXPECTED_FIELDS[SOURCE_META[target].category] || EXPECTED_FIELDS.gateway;
      const saved = loadColumnMap(target);
      const auto = saved || autoMapHeaders(headers, expected);
      const missing = missingExpected(auto, expected, 2);
      if (missing.length > 0 && headers.length > 0) {
        setMapper({ target, file, headers, rows, expected, initialMap: auto });
        return;
      }
      const mapped = Object.keys(auto).length ? applyColumnMap(rows, auto) : rows;
      if (Object.keys(auto).length) saveColumnMap(target, auto);
      commitRows(target, file, mapped);
    } catch {
      setError(`Failed to parse ${file.name}`);
    }
  }, [commitRows]);

  const handleDrop = useCallback((e: React.DragEvent, target: SourceType) => {
    e.preventDefault();
    setDragging((d) => ({ ...d, [target]: false }));
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file, target);
  }, [handleFile]);

  const generateMockCSV = (target: SourceType): string => {
    const meta = SOURCE_META[target];
    const cat = meta.category;

    if (cat === "platform") {
      return [
        ["Name", "Financial Status", "Total", "Paid at", "Payment Method", "Gateway Transaction ID"],
        [`#${target.toUpperCase()}_1001`, "paid", "2499.00", "2026-07-15 10:00:00", "card", `ch_${target}_1001`],
        [`#${target.toUpperCase()}_1002`, "paid", "3499.00", "2026-07-15 10:30:00", "upi", `ch_${target}_1002`],
        [`#${target.toUpperCase()}_1003`, "paid", "1250.00", "2026-07-15 11:15:00", "cod", `awb_${target}_1003`],
        [`#${target.toUpperCase()}_1004`, "pending", "899.00", "2026-07-15 12:00:00", "unknown", ""],
        [`#${target.toUpperCase()}_1005`, "paid", "4500.00", "2026-07-15 12:30:00", "card", `ch_${target}_1005`]
      ].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    }

    if (cat === "gateway") {
      return [
        ["payment_id", "order_id", "amount", "fee", "tax", "created_at", "settled_at", "settlement_id"],
        [`ch_shopify_1001`, "#SHOPIFY_1001", "2499.00", "50.00", "9.00", "2026-07-15 10:05:00", "2026-07-16 12:00:00", `UTR_${target.toUpperCase()}_99`],
        [`ch_shopify_1002`, "#SHOPIFY_1002", "3499.00", "70.00", "12.60", "2026-07-15 10:35:00", "2026-07-16 12:00:00", `UTR_${target.toUpperCase()}_99`],
        [`ch_shopify_1005`, "#SHOPIFY_1005", "4500.00", "90.00", "16.20", "2026-07-15 12:35:00", "2026-07-16 12:00:00", `UTR_${target.toUpperCase()}_99`]
      ].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    }

    if (cat === "shipping") {
      return [
        ["AWB", "Order ID", "COD Amount", "Shipping Charges", "Tax", "Delivery Date", "Remittance Date", "UTR"],
        [`awb_shopify_1003`, "#SHOPIFY_1003", "1250.00", "80.00", "14.40", "2026-07-16 10:00:00", "2026-07-18 12:00:00", `UTR_${target.toUpperCase()}_88`]
      ].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    }

    if (cat === "marketplace") {
      return [
        ["Order ID", "Sale Amount", "Commission", "Shipping Charge", "Tax", "Net Settlement Amount", "Settlement Date", "UTR"],
        [`OD_${target.toUpperCase()}_1001`, "1499.00", "150.00", "65.00", "38.70", "1245.30", "2026-07-15 17:30:00", `UTR_${target.toUpperCase()}_77`],
        [`OD_${target.toUpperCase()}_1002`, "2499.00", "250.00", "75.00", "58.50", "2115.50", "2026-07-15 18:00:00", `UTR_${target.toUpperCase()}_77`]
      ].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    }

    if (cat === "bank") {
      return [
        ["Date", "Description", "Reference Number", "Amount", "Deposit", "Credit"],
        ["2026-07-16 15:00:00", `SETTLEMENT FROM GATEWAY`, `UTR_RAZORPAY_99`, "10250.20", "10250.20", "10250.20"],
        ["2026-07-16 16:30:00", `UPI PAYMENT RECEIVED`, `RECONCILEX_PRO_4999`, "4999.00", "4999.00", "4999.00"],
        ["2026-07-16 16:35:00", `UPI PAYMENT RECEIVED`, `RECONCILEX_PRO_9999`, "9999.00", "9999.00", "9999.00"],
        ["2026-07-16 16:40:00", `UPI PAYMENT RECEIVED`, `RECONCILEX_PRO_29999`, "29999.00", "29999.00", "29999.00"]
      ].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    }

    if (cat === "accounting") {
      return [
        ["Voucher Number", "Date", "Amount", "Payment Reference", "Payment Type"],
        [`#ACC_${target.toUpperCase()}_1001`, "2026-07-15", "2499.00", `ch_shopify_1001`, "card"],
        [`#ACC_${target.toUpperCase()}_1002`, "2026-07-15", "3499.00", `ch_shopify_1002`, "upi"]
      ].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    }

    if (cat === "ads") {
      return [
        ["Date", "Transaction ID", "Amount", "Cost", "Spent"],
        ["2026-07-15", `AD_${target.toUpperCase()}_CAMP_01`, "500.00", "500.00", "500.00"]
      ].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    }

    return "";
  };

  const loadSample = async (target: SourceType) => {
    const path = `/sample/${target}_sample.csv`;
    try {
      const res  = await fetch(path);
      if (!res.ok) throw new Error("Mock fallback");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv" });
      const file = new File([blob], `${target}_sample.csv`, { type: "text/csv" });
      await handleFile(file, target);
    } catch {
      const csv = generateMockCSV(target);
      if (csv) {
        const blob = new Blob([csv], { type: "text/csv" });
        const file = new File([blob], `${target}_sample.csv`, { type: "text/csv" });
        await handleFile(file, target);
      } else {
        setError(`Failed to load ${target} sample data.`);
      }
    }
  };

  const handleRunRecon = useCallback(async (currentUser?: UserSession | null) => {
    const activeUser = currentUser !== undefined ? currentUser : user;
    if (enabledSources.length === 0) {
      setError("Please select at least one data channel above to run reconciliation.");
      return;
    }
    const hasData = enabledSources.every((src) => files[src].rows.length > 0);
    if (!hasData) {
      setError("Please upload files for all selected data channels to run reconciliation.");
      return;
    }

    // Persist payload before auth redirect so OAuth return can open /results
    try {
      const payload = {
        enabledSources,
        data: enabledSources.reduce((acc, src) => {
          acc[src] = files[src].rows;
          return acc;
        }, {} as Record<SourceType, Record<string, string>[]>)
      };
      sessionStorage.setItem("refract_payload", JSON.stringify(payload));
    } catch {
      setError("Data size limit exceeded. Please upload smaller exports.");
      return;
    }

    if (!activeUser) {
      sessionStorage.setItem("refract_pending_recon", "1");
      setShowAuthModal(true);
      return;
    }

    setProcessing(true);
    setError(null);
    sessionStorage.removeItem("refract_pending_recon");
    router.push("/results");
  }, [user, enabledSources, files, router]);

  const allLoaded = enabledSources.length > 0 && enabledSources.every((src) => files[src].rows.length > 0);

  const features = [
    { icon: CheckCircle, label: "Matched orders",   desc: "Multi-source matching engine linking channels", variant: "green" as const },
    { icon: AlertTriangle, label: "Exceptions flagged", desc: "Settled no order, overdue, mismatches flagged", variant: "red" as const },
    { icon: Percent, label: "Fee audit",         desc: "Compare gateway charges with contracted rates", variant: "yellow" as const },
    { icon: FileSpreadsheet, label: "Excel export",      desc: "Autofitted multi-tab report for accounting", variant: "blue" as const },
  ];

  return (
    <>
      <div className="page-root">
        <SiteNav
          returnTo="/"
          user={user}
          onUserChange={setUser}
          onRequestSignIn={() => setShowAuthModal(true)}
        />

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="hero">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
          >
            <motion.div variants={fadeUp} custom={0} className="hero-eyebrow">
              <span className="hero-dot" />
              Unified D2C Reconciliation Platform
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="hero-title">
              Every mismatch found.
              <br />
              <span className="gradient-text">Every rupee accounted for.</span>
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="hero-subtitle">
              Match orders, payouts, and settlements from Shopify, Razorpay, Amazon, and 50+ channels —
              in your browser, in under 30 seconds.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="hero-cta-row">
              <a href="#tool" className="btn btn-primary">Run free recon</a>
              <a href="#walkthrough" className="btn btn-secondary">See how it works</a>
              <a href="/pricing" className="btn btn-secondary">View pricing</a>
            </motion.div>
          </motion.div>
        </section>

        {/* ── Upload Section ────────────────────────────────────────────────── */}
        <main id="tool" className="page-wrapper">
          <div style={{ maxWidth: 740, margin: "0 auto" }}>

            {/* Source Configuration Grid */}
            <motion.div
              className="sources-section"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ marginBottom: "var(--sp-8)" }}
            >
              <h2 className="section-title text-center" style={{ fontSize: "1.1rem", marginBottom: "var(--sp-4)", letterSpacing: "0.02em" }}>
                Active Data Channels
              </h2>

              {/* Category Tabs */}
              <div className="category-tabs">
                {CATEGORIES.map((cat) => {
                  const CatIcon = cat.icon;
                  const isActive = activeCategory === cat.key;
                  const enabledCount = enabledSources.filter(s => SOURCE_META[s].category === cat.key).length;
                  return (
                    <motion.button
                      key={cat.key}
                      className={`category-tab ${isActive ? "active" : ""}`}
                      onClick={() => setActiveCategory(cat.key)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      layout
                    >
                      <CatIcon size={13} strokeWidth={2} />
                      <span>{cat.label}</span>
                      {enabledCount > 0 && (
                        <span className="category-tab-count">{enabledCount}</span>
                      )}
                      {isActive && (
                        <motion.div
                          className="category-tab-indicator"
                          layoutId="categoryIndicator"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Active Category Chips */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory}
                  className="sources-grid"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  style={{ marginTop: 12 }}
                >
                  {Object.entries(SOURCE_META)
                    .filter(([, m]) => m.category === activeCategory)
                    .map(([src, meta], i) => {
                      const enabled = enabledSources.includes(src as SourceType);
                      const Icon = meta.icon;
                      return (
                        <motion.div
                          key={src}
                          onClick={() => toggleSource(src as SourceType)}
                          className={`source-chip ${enabled ? "active" : ""}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.03, duration: 0.2 }}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Icon size={14} strokeWidth={2} style={{ color: enabled ? 'var(--t-hi)' : 'var(--t-dim)', flexShrink: 0 }} />
                          <span className="source-chip-label">{meta.label}</span>
                        </motion.div>
                      );
                    })}
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* Compact Upload List */}
            <motion.div
              className="compact-upload-list"
              initial="hidden"
              animate="visible"
              variants={stagger}
            >
              {enabledSources.length === 0 ? (
                <div
                  style={{
                    padding: "36px 20px",
                    textAlign: "center",
                    borderRadius: "var(--r-lg)",
                    border: "1px dashed var(--b-line)",
                    background: "var(--bg-glass)",
                    color: "var(--t-dim)",
                    fontSize: 13.5,
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 500 }}>
                    No channels selected yet. Click any channel above to enable and upload your exports.
                  </p>
                </div>
              ) : (
                enabledSources.map((target) => {
                  const state = files[target];
                  const drag = dragging[target];
                  const meta = SOURCE_META[target];
                  const loaded = state.rows.length > 0;

                  return (
                    <div
                      key={target}
                      className={`compact-upload-row ${drag ? "dragging" : ""} ${loaded ? "loaded" : ""}`}
                      onClick={() => {
                        if (!loaded) inputRefs.current.get(target)?.click();
                      }}
                      onDragOver={(e) => { e.preventDefault(); setDragging((d) => ({ ...d, [target]: true })); }}
                      onDragLeave={() => setDragging((d) => ({ ...d, [target]: false }))}
                      onDrop={(e) => handleDrop(e, target)}
                    >
                      <input
                        ref={setInputRef(target)}
                        type="file"
                        accept=".csv"
                        style={{ display: "none" }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, target); }}
                        id={`${target}-input`}
                      />

                      <div className="compact-row-left">
                        <GlassIcon
                          icon={loaded ? Check : meta.icon}
                          variant={loaded ? "green" : meta.variant}
                          size="sm"
                          style={{ borderRadius: 6 }}
                        />
                        <div className="compact-row-info">
                          <div className="compact-row-title">{meta.label}</div>
                          {loaded ? (
                            <div className="compact-row-desc success">
                              ✓ {state.name} · {state.rows.length} rows loaded
                            </div>
                          ) : (
                            <div className="compact-row-desc">
                              Drag & drop or click to upload CSV
                              <div className="upload-hint">{meta.hint}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {loaded ? (
                          <button
                            className="btn-compact-clear"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFiles((f) => ({ ...f, [target]: { file: null, rows: [], name: "" } }));
                            }}
                            title="Clear file"
                          >
                            <X size={12} strokeWidth={2.5} />
                          </button>
                        ) : (
                          <span className="text-accent" style={{ fontSize: 12.5, fontWeight: 600 }}>
                            Browse
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </motion.div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    background: "rgba(248,113,113,0.10)",
                    border: "1px solid rgba(248,113,113,0.28)",
                    borderRadius: "var(--r-md)",
                    padding: "var(--sp-3) var(--sp-5)",
                    color: "var(--red)",
                    fontSize: 13.5,
                    marginBottom: "var(--sp-4)",
                    textAlign: "center",
                  }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.55, ease: [0.16,1,0.3,1] }}
              className="flex-center"
              style={{ flexDirection: "column", gap: "var(--sp-4)" }}
            >
              <MagneticButton
                id="run-recon-btn"
                className="btn btn-primary"
                disabled={!allLoaded || processing}
                onClick={handleRunRecon}
              >
                {processing ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
                      style={{ display: "inline-block",
                        width: 16, height: 16,
                        border: "2px solid var(--btn-primary-spinner-border)",
                        borderTopColor: "var(--btn-primary-spinner-active)",
                        borderRadius: "50%",
                      }}
                    />
                    Running recon…
                  </>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                    <GlassIcon icon={Zap} variant="dark" size="sm" />
                    <span>Run Reconciliation</span>
                  </span>
                )}
              </MagneticButton>

              <AnimatePresence>
                {!allLoaded && (
                  <motion.p
                    key="hint"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-muted"
                    style={{ fontSize: 13 }}
                  >
                    {enabledSources.length === 0
                      ? "Select data channels above to get started"
                      : "Upload files for all active data channels to continue"}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Sample links */}
            <motion.div
              className="sample-links"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
              style={{ marginTop: "var(--sp-6)" }}
            >
              <button
                type="button"
                className="sample-link"
                onClick={() => {
                  saveChannelPreset(enabledSources);
                  setError(null);
                }}
              >
                Save channel preset
              </button>
              <span className="text-muted" style={{ fontSize: 13 }}>· No files yet? Try sample data:</span>
              <button
                className="sample-link"
                style={{ fontWeight: 700, color: "var(--t-hi)" }}
                onClick={async () => {
                  setError(null);
                  const demoSources = ["shopify", "razorpay"] as SourceType[];
                  setEnabledSources(demoSources);
                  for (const src of demoSources) {
                    await loadSample(src);
                  }
                  // Ensure payload and go
                  setTimeout(() => {
                    const btn = document.getElementById("run-recon-btn") as HTMLButtonElement | null;
                    btn?.click();
                  }, 400);
                }}
              >
                ▶ One-click demo recon
              </button>
              <button
                className="sample-link"
                style={{ fontWeight: 650, color: "var(--t-hi)" }}
                onClick={async () => {
                  if (enabledSources.length === 0) {
                    setError("Please select at least one channel above first, or use One-click demo recon.");
                    return;
                  }
                  for (const src of enabledSources) {
                    await loadSample(src);
                  }
                }}
              >
                ↓ Load Enabled Samples
              </button>
              <span className="text-muted" style={{ fontSize: 13 }}>or</span>
              <a
                href="/sample/refract_test_sheets.xlsx"
                download
                className="sample-link"
                style={{ fontWeight: 650, color: "var(--t-hi)" }}
              >
                ↓ Unified Excel Test File
              </a>
            </motion.div>

            {/* Compact feature badges */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <motion.div
                className="compact-features-row"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.6, ease: [0.16,1,0.3,1] }}
              >
                {features.map((f) => (
                  <div key={f.label} className="compact-feature-badge">
                    <GlassIcon icon={f.icon} variant={f.variant} size="xs" style={{ borderRadius: 4 }} />
                    <span>{f.label}</span>
                  </div>
                ))}
              </motion.div>
            </div>

          </div>
        </main>

        <section id="walkthrough" className="home-section">
          <div className="home-section-head">
            <h2>30-second walkthrough</h2>
            <p>A guided loop you can follow without leaving the page.</p>
          </div>
          <div className="walkthrough-track">
            {[
              { t: "Pick channels", d: "Enable Shopify + Razorpay (or your stack) from the category tabs." },
              { t: "Drop CSVs", d: "Upload exports — we hint the menu path and map columns if headers differ." },
              { t: "Run recon", d: "Sign in once, then match orders to payouts entirely in your browser." },
              { t: "Fix exceptions", d: "Use next-step guidance per mismatch type, then export Excel on Pro." },
            ].map((s, i) => (
              <div key={s.t} className="walkthrough-step">
                <div className="step-num">{i + 1}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="social-proof" className="home-section">
          <div className="home-section-head">
            <h2>Built for D2C finance teams</h2>
            <p>What operators say they need — and what ReconcileX delivers.</p>
          </div>
          <div className="testimonials-grid">
            <blockquote className="testimonial-card">
              <p>“We were reconciling Shopify and Razorpay in sheets every week. Browser matching cut that to minutes.”</p>
              <footer>— D2C brand finance lead</footer>
            </blockquote>
            <blockquote className="testimonial-card">
              <p>“Fee anomalies finally show up without a separate MDR tracker. Export goes straight to our CA.”</p>
              <footer>— Marketplace seller ops</footer>
            </blockquote>
            <blockquote className="testimonial-card">
              <p>“CSVs never leave the laptop for matching. That was the requirement from our security checklist.”</p>
              <footer>— Founder, multi-channel store</footer>
            </blockquote>
          </div>
          <p className="home-section-head" style={{ marginTop: 18, marginBottom: 0 }}>
            <span style={{ color: "var(--t-dim)", fontSize: 13 }}>Used with exports from Shopify · Razorpay · Amazon · Shiprocket · WooCommerce · Stripe</span>
          </p>
        </section>

        <section id="how-it-works" className="home-section">
          <div className="home-section-head">
            <h2>How it works</h2>
            <p>Three steps from export to a clean reconciliation report.</p>
          </div>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-num">1</div>
              <h3>Export your CSVs</h3>
              <p>Pull orders, settlements, and remittances from your store, gateway, marketplace, or bank.</p>
            </div>
            <div className="step-card">
              <div className="step-num">2</div>
              <h3>Match in the browser</h3>
              <p>ReconcileX links channels locally — file contents are not uploaded for matching.</p>
            </div>
            <div className="step-card">
              <div className="step-num">3</div>
              <h3>Review &amp; export</h3>
              <p>Inspect exceptions on screen. Pro unlocks the full multi-sheet Excel workbook.</p>
            </div>
          </div>
        </section>

        <section id="features" className="home-section">
          <div className="home-section-head">
            <h2>Built for D2C finance ops</h2>
            <p>Everything you need to close settlement cycles without spreadsheet chaos.</p>
          </div>
          <div className="features-grid">
            {features.map((f) => (
              <div key={f.label} className="feature-card">
                <GlassIcon icon={f.icon} variant={f.variant} size="sm" style={{ borderRadius: 8, marginBottom: 12 }} />
                <h3>{f.label}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="home-section">
          <div className="home-section-head">
            <h2>Free to run. Pro to export.</h2>
            <p>Reconcile anytime on Free. Upgrade when you need full Excel exports and priority support.</p>
          </div>
          <div className="home-pricing-cta">
            <a href="/pricing" className="btn btn-primary">See plans &amp; pricing</a>
          </div>
        </section>

        <section id="faq" className="home-section" style={{ paddingBottom: 24 }}>
          <div className="home-section-head">
            <h2>FAQ</h2>
            <p>Straight answers before you upload a ledger.</p>
          </div>
          <div className="faq-list">
            <div className="faq-item">
              <h3>Does my CSV leave the browser?</h3>
              <p>Matching runs client-side. We only store account details for Google sign-in and UTR payment verification.</p>
            </div>
            <div className="faq-item">
              <h3>What do I get on Free vs Pro?</h3>
              <p>Free includes unlimited on-screen recon runs. Pro unlocks the full Excel export after UPI payment is verified by an admin.</p>
            </div>
            <div className="faq-item">
              <h3>Which files do you support?</h3>
              <p>CSV exports from major platforms, gateways, marketplaces, shipping remittances, banks, and accounting tools. Use sample data to try instantly.</p>
            </div>
            <div className="faq-item">
              <h3>How does Pro payment work?</h3>
              <p>Pay via UPI from checkout, submit your UTR, and an admin activates Pro on your account — usually after verifying the reference.</p>
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        returnTo="/"
      />

      {mapper && (
        <ColumnMapper
          sourceLabel={SOURCE_META[mapper.target].label}
          csvHeaders={mapper.headers}
          expected={mapper.expected}
          initialMap={mapper.initialMap}
          onCancel={() => setMapper(null)}
          onApply={(map) => {
            saveColumnMap(mapper.target, map);
            commitRows(mapper.target, mapper.file, applyColumnMap(mapper.rows, map));
            setMapper(null);
          }}
        />
      )}
    </>
  );
}
