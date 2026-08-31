export type AdminUser = {
  uid: string;
  name: string;
  email: string;
  avatar?: string;
  photoURL?: string | null;
  isPro?: boolean;
  plan?: "monthly" | "quarterly" | "annual" | null;
  utrValue?: string | null;
  status?: string;
  createdAt?: string;
  lastLoginAt?: string;
  teamId?: string | null;
  teamName?: string;
  brandId?: string | null;
  brandName?: string;
};

export type AdminPayment = {
  id: string;
  userId: string;
  email: string;
  name?: string;
  plan: "monthly" | "quarterly" | "annual";
  amount: number;
  utr: string;
  method?: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  razorpaySubscriptionId?: string | null;
  autoRenew?: boolean;
  status: "pending" | "approved" | "rejected" | "cancelled" | "failed" | "refunded";
  createdAt: string;
  reviewedAt?: string | null;
  note?: string;
};

export type AdminSettings = {
  upiId: string;
  qrPath: string;
  payeeName?: string;
  plans: Record<string, { label: string; amount: number }>;
  gstin?: string;
  gstRate?: number;
  billingAddress?: string;
  updatedAt?: string | null;
};

export type AuditEvent = {
  id: string;
  action: string;
  at: string;
  actor?: string;
  [key: string]: unknown;
};

export type DashboardData = {
  stats: {
    users: number;
    proUsers: number;
    pendingPayments: number;
    approvedPayments: number;
    rejectedPayments: number;
  };
  recentUsers: AdminUser[];
  recentPayments: AdminPayment[];
};

async function adminFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
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

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const v = String(cell ?? "");
          if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
          return v;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const adminApi = {
  me: () =>
    adminFetch<{
      authenticated: boolean;
      admin?: { role?: string; loggedInAt?: string };
      permissions?: {
        canMutateUsers?: boolean;
        canReviewPayments?: boolean;
        canEditSettings?: boolean;
        canControl?: boolean;
      };
    }>("/api/admin/me.php"),
  login: (password: string) =>
    adminFetch<{ success: boolean; admin: { role: string } }>("/api/admin/login.php", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: () =>
    adminFetch<{ success: boolean }>("/api/admin/logout.php", { method: "POST" }),
  dashboard: () => adminFetch<DashboardData>("/api/admin/dashboard.php"),
  users: (q = "") =>
    adminFetch<{ users: AdminUser[] }>(
      `/api/admin/users.php${q ? `?q=${encodeURIComponent(q)}` : ""}`
    ),
  updateUser: (body: Record<string, unknown>) =>
    adminFetch<{ success: boolean; user: AdminUser }>("/api/admin/users.php", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  payments: (status = "", q = "") => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    const qs = params.toString();
    return adminFetch<{ payments: AdminPayment[] }>(
      `/api/admin/payments.php${qs ? `?${qs}` : ""}`
    );
  },
  reviewPayment: (body: {
    id: string;
    action: "approve" | "reject" | "refund";
    note?: string;
  }) =>
    adminFetch<{ success: boolean; payment: AdminPayment }>("/api/admin/payments.php", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  settings: () => adminFetch<{ settings: AdminSettings }>("/api/admin/settings.php"),
  saveSettings: (settings: Partial<AdminSettings>) =>
    adminFetch<{ success: boolean; settings: AdminSettings }>("/api/admin/settings.php", {
      method: "POST",
      body: JSON.stringify(settings),
    }),
  uploadQr: (file: File) => {
    const fd = new FormData();
    fd.append("qr", file);
    return adminFetch<{ success: boolean; qrPath: string; settings: AdminSettings }>(
      "/api/admin/upload-qr.php",
      { method: "POST", body: fd }
    );
  },
  audit: (limit = 100) =>
    adminFetch<{ events: AuditEvent[] }>(`/api/admin/audit.php?limit=${limit}`),
  analytics: (days = 30) =>
    adminFetch<{
      analytics: {
        days: number;
        funnel: {
          pricing_view: number;
          checkout_open: number;
          payment_started: number;
          payment_success: number;
          conversion: number;
        };
        payments: {
          approved: number;
          failed: number;
          refunded: number;
          revenueInr: number;
        };
        events: Record<string, number>;
      };
      storage: { sqlite: boolean };
    }>(`/api/admin/analytics.php?days=${days}`),
  control: () =>
    adminFetch<{
      featureFlags: Record<string, boolean>;
      matchRules: {
        settlementWindowDays: number;
        amountTolerancePaise: number;
        feePct: number;
        feeAnomalyFactor: number;
        fuzzyWindowDays: number;
      };
      announcement: { enabled: boolean; message: string; level: string };
      alerts: {
        enabled: boolean;
        thresholdInr: number;
        email: string;
        slackWebhook: string;
      };
      trialCodes: Array<{
        code: string;
        days: number;
        maxUses: number;
        used: number;
        active: boolean;
        note?: string;
      }>;
      changelog: Array<{ id: string; title: string; body: string; at: string; published?: boolean }>;
      brands: Array<{ id: string; name: string; ownerUid: string; createdAt: string }>;
      aiConfigured?: boolean;
      adminRolesConfigured?: { super: boolean; billing: boolean; viewer: boolean };
    }>("/api/admin/control.php"),
  controlAction: (body: Record<string, unknown>) =>
    adminFetch<Record<string, unknown>>("/api/admin/control.php", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
