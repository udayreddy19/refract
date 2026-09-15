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
  city?: string;
  notes?: string;
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
    adminFetch<{ success: boolean; agent: PayflowAgent }>("/api/payflow/admin/agents.php", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  wallets: (uid = "") => {
    const qs = uid ? `?uid=${encodeURIComponent(uid)}` : "";
    return adminFetch<{ wallets: PayflowAgent[] }>(`/api/payflow/admin/wallets.php${qs}`);
  },

  adjustWallet: (body: {
    uid?: string;
    agentId?: string;
    direction: "credit" | "debit";
    amount: number;
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
};
