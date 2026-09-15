async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (!(init?.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export type PayflowAgent = {
  uid: string;
  agentId: string;
  name: string;
  email: string;
  mobile: string;
  status: "active" | "disabled" | string;
  kycStatus?: "pending" | "verified" | "blocked" | string;
  city?: string;
  notes?: string;
  parentUid?: string | null;
  locale?: string;
  branding?: { logoUrl?: string; primaryColor?: string; displayName?: string } | null;
  hasPin?: boolean;
  dailyDebitCap?: number | null;
  balance: number;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
};

export type PayflowLedgerEntry = {
  id: string;
  uid: string;
  type: string;
  amount: number;
  balance: number;
  createdAt: string;
  note?: string;
  source?: string;
  agentId?: string;
  agentName?: string;
};

export type PayflowAuditEntry = {
  id: string;
  action: string;
  actorRole?: string;
  uid?: string;
  reason?: string;
  receiptId?: string;
  at: string;
  agentId?: string;
};

export type PayflowDispute = {
  id: string;
  uid: string;
  agentId: string;
  utr: string;
  amount: number;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type PayflowAdminDashboard = {
  stats: {
    agents: number;
    activeAgents: number;
    disabledAgents: number;
    totalWalletBalance: number;
    ledgerEntries: number;
    creditsVolume: number;
    debitsVolume: number;
    todayVolume: number;
  };
  recentAgents: PayflowAgent[];
  recentLedger: PayflowLedgerEntry[];
};

export const payflowAdminApi = {
  dashboard: () => adminFetch<PayflowAdminDashboard>("/api/payflow/admin/dashboard.php"),

  agents: (q = "", status = "") => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    const qs = params.toString();
    return adminFetch<{ agents: PayflowAgent[] }>(
      `/api/payflow/admin/agents.php${qs ? `?${qs}` : ""}`
    );
  },

  mutateAgent: (body: Record<string, unknown>) =>
    adminFetch<{ success: boolean; agent: PayflowAgent; created?: PayflowAgent[]; errors?: unknown[] }>(
      "/api/payflow/admin/agents.php",
      { method: "POST", body: JSON.stringify(body) }
    ),

  wallets: (uid = "") => {
    const qs = uid ? `?uid=${encodeURIComponent(uid)}` : "";
    return adminFetch<{ wallets: PayflowAgent[] }>(`/api/payflow/admin/wallets.php${qs}`);
  },

  adjustWallet: (body: {
    uid?: string;
    agentId?: string;
    direction: "credit" | "debit";
    amount: number;
    reason: string;
    receiptId: string;
    note?: string;
  }) =>
    adminFetch<{ success: boolean; balance: number; agent: PayflowAgent }>(
      "/api/payflow/admin/wallets.php",
      { method: "POST", body: JSON.stringify(body) }
    ),

  ledger: (opts?: { uid?: string; agentId?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.uid) params.set("uid", opts.uid);
    if (opts?.agentId) params.set("agentId", opts.agentId);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return adminFetch<{ entries: PayflowLedgerEntry[] }>(
      `/api/payflow/admin/ledger.php${qs ? `?${qs}` : ""}`
    );
  },

  audit: (limit = 100, action = "") => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (action) params.set("action", action);
    return adminFetch<{ entries: PayflowAuditEntry[]; mysql: boolean }>(
      `/api/payflow/admin/audit.php?${params}`
    );
  },

  migrate: () =>
    adminFetch<{ success: boolean; imported: Record<string, number> }>(
      "/api/payflow/admin/migrate.php",
      { method: "POST", body: "{}" }
    ),

  disputes: (status = "") => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return adminFetch<{ disputes: PayflowDispute[] }>(`/api/payflow/admin/disputes.php${qs}`);
  },

  mutateDispute: (body: Record<string, unknown>) =>
    adminFetch<{ success: boolean; dispute?: PayflowDispute }>("/api/payflow/admin/disputes.php", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  settlements: (uid = "") => {
    const qs = uid ? `?uid=${encodeURIComponent(uid)}` : "";
    return adminFetch<{
      settlements: Array<{
        id: string;
        uid: string;
        day: string;
        openingBalance: number;
        closingBalance: number;
        credits: number;
        debits: number;
      }>;
      commissionRules: Array<{
        id: string;
        product: string;
        feeFlat: number;
        feePct: number;
        marginFlat: number;
        marginPct: number;
        active: boolean;
      }>;
    }>(`/api/payflow/admin/settlements.php${qs}`);
  },

  updateCommission: (body: Record<string, unknown>) =>
    adminFetch<{ success: boolean }>("/api/payflow/admin/settlements.php", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
