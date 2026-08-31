export interface UserSession {
  uid: string;
  name: string;
  email: string;
  avatar: string;
  isPro?: boolean;
  selectedPlan?: "monthly" | "quarterly" | "annual";
  utrValue?: string;
  photoURL?: string | null;
  paymentStatus?: "pending" | "approved" | null;
  reminderHour?: number;
  teamName?: string;
  teamId?: string | null;
  teamRole?: string | null;
  proExpiresAt?: string | null;
  autoRenew?: boolean;
  proViaTeam?: boolean;
  connections?: Array<{
    provider: string;
    label?: string;
    status?: string;
    notes?: string;
  }>;
  pendingPayment?: {
    id: string;
    plan: string;
    utr: string;
    status: string;
    amount?: number;
  } | null;
}

export type PublicSettings = {
  upiId: string;
  qrPath: string;
  payeeName?: string;
  plans: Record<string, { label: string; amount: number }>;
  razorpayEnabled?: boolean;
  razorpayKeyId?: string;
  gstin?: string;
  matchRules?: {
    settlementWindowDays: number;
    amountTolerancePaise: number;
    feePct: number;
    feeAnomalyFactor: number;
    fuzzyWindowDays: number;
  };
  featureFlags?: {
    sampleDemo?: boolean;
    trialCodes?: boolean;
    agencyBrands?: boolean;
    csvReplay?: boolean;
    publicChangelog?: boolean;
    maintenanceMode?: boolean;
  };
  announcement?: {
    enabled?: boolean;
    message?: string;
    level?: string;
  };
};

export type MyPayment = {
  id: string;
  plan: string;
  amount: number;
  utr: string;
  status: string;
  createdAt: string;
  note?: string;
  method?: string;
};

export type SavedRun = {
  id: string;
  label: string;
  sources: string[];
  summary: {
    totalOrders: number;
    totalPayments: number;
    matchedCount: number;
    exceptionCount: number;
    autoMatchRate: number;
    amountAtRiskPaise: number;
    totalNetPaise: number;
  };
  createdAt: string;
  hasPayload?: boolean;
  workflow?: Record<string, { status: string; note?: string; assignee?: string }>;
  exceptionTypes?: string[];
  brandId?: string | null;
  payloadB64?: string | null;
};

export type TeamInfo = {
  id: string;
  name: string;
  ownerUid: string;
  inviteCode: string;
  createdAt: string;
};

const SESSION_KEY = "refract_user";

const persistLocalSession = (session: UserSession | null) => {
  if (typeof window === "undefined") return;
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("refract_pro_active");
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (session.isPro) {
    localStorage.setItem("refract_pro_active", "true");
  } else {
    localStorage.removeItem("refract_pro_active");
  }
};

export const getUserSession = async (): Promise<UserSession | null> => {
  try {
    const res = await fetch("/api/me.php", {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        authenticated?: boolean;
        user?: UserSession | null;
      };
      if (data.authenticated && data.user) {
        const session: UserSession = {
          ...data.user,
          isPro: !!data.user.isPro,
          selectedPlan: data.user.selectedPlan,
          utrValue: data.user.utrValue,
          paymentStatus: data.user.paymentStatus ?? null,
          pendingPayment: data.user.pendingPayment ?? null,
          reminderHour: data.user.reminderHour ?? 9,
          teamName: data.user.teamName || "",
          teamId: data.user.teamId ?? null,
          teamRole: data.user.teamRole ?? null,
          proExpiresAt: data.user.proExpiresAt ?? null,
          autoRenew: !!data.user.autoRenew,
          proViaTeam: !!data.user.proViaTeam,
          connections: data.user.connections || [],
        };
        persistLocalSession(session);
        return session;
      }
      persistLocalSession(null);
      return null;
    }
    persistLocalSession(null);
    return null;
  } catch {
    persistLocalSession(null);
    return null;
  }
};

export const getPublicSettings = async (): Promise<PublicSettings | null> => {
  try {
    const res = await fetch("/api/settings.php", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { settings?: PublicSettings };
    return data.settings || null;
  } catch {
    return null;
  }
};

export const redeemTrialCode = async (code: string) => {
  const res = await fetch("/api/trial/redeem.php", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Invalid trial code.");
  return data as { message: string; days: number; proExpiresAt?: string };
};

export const getChangelog = async () => {
  const res = await fetch("/api/changelog.php", { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  return ((data as { entries?: Array<{ id: string; title: string; body: string; at: string }> }).entries || []);
};

export const getMyBrands = async () => {
  const res = await fetch("/api/brands/mine.php", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to load brands.");
  return data as {
    brands: Array<{ id: string; name: string; ownerUid: string }>;
    activeBrandId: string | null;
    activeBrandName: string;
  };
};

export const brandAction = async (body: Record<string, unknown>) => {
  const res = await fetch("/api/brands/mine.php", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Brand action failed.");
  return data;
};

export const getRunById = async (id: string): Promise<SavedRun> => {
  const res = await fetch(`/api/runs/mine.php?id=${encodeURIComponent(id)}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Run not found.");
  return (data as { run: SavedRun }).run;
};

export const updateRunWorkflow = async (
  id: string,
  workflow: Record<string, { status: string; note?: string; assignee?: string }>
) => {
  const res = await fetch("/api/runs/mine.php", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ action: "workflow", id, workflow }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Workflow update failed.");
  return data;
};

export const getMyPayments = async (): Promise<MyPayment[]> => {
  const res = await fetch("/api/payments/mine.php", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Failed to load payments.");
  }
  return ((data as { payments?: MyPayment[] }).payments || []);
};

export const updateAccountPreferences = async (body: {
  reminderHour?: number;
  teamName?: string;
  connections?: UserSession["connections"];
}): Promise<UserSession> => {
  const res = await fetch("/api/account/preferences.php", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Failed to save preferences.");
  }
  const user = (data as { user: UserSession }).user;
  const session = await getUserSession();
  return session || user;
};

/** Redirects the browser to ServerByt Google OAuth start. */
export const signInWithGoogle = async (returnTo = "/"): Promise<void> => {
  if (typeof window === "undefined") {
    throw new Error("Google sign-in requires a browser.");
  }
  const safeReturn = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  window.location.assign(`/api/google-start.php?returnTo=${encodeURIComponent(safeReturn)}`);
};

export const signOutUser = async (): Promise<void> => {
  try {
    await fetch("/api/logout.php", {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
  } catch {
    // Still clear local session
  }
  persistLocalSession(null);
};

export const submitPaymentUtr = async (params: {
  plan: "monthly" | "quarterly" | "annual";
  utr: string;
}): Promise<{ message: string; payment: { id: string; status: string } }> => {
  const res = await fetch("/api/payments/submit.php", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Failed to submit UTR.");
  }
  return data as { message: string; payment: { id: string; status: string } };
};

export type RazorpayOrderResponse = {
  success: boolean;
  mode?: "order" | "subscription";
  keyId: string;
  order: { id: string; amount: number; currency: string; receipt: string } | null;
  subscription?: { id: string } | null;
  payment: { id: string; status: string };
  prefill: { name: string; email: string };
};

export const createRazorpayOrder = async (
  plan: "monthly" | "quarterly" | "annual",
  autoRenew = false
): Promise<RazorpayOrderResponse> => {
  const res = await fetch("/api/payments/razorpay-create.php", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plan, autoRenew }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Failed to create Razorpay order.");
  }
  return data as RazorpayOrderResponse;
};

export const verifyRazorpayPayment = async (params: {
  razorpay_order_id?: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_subscription_id?: string;
}): Promise<{ message: string; payment: { id: string; status: string } }> => {
  const res = await fetch("/api/payments/razorpay-verify.php", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Failed to verify Razorpay payment.");
  }
  return data as { message: string; payment: { id: string; status: string } };
};

export const trackEvent = async (event: string, meta: Record<string, unknown> = {}) => {
  try {
    await fetch("/api/analytics/track.php", {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ event, meta }),
    });
  } catch {
    // non-blocking
  }
};

export const getMyRuns = async (): Promise<SavedRun[]> => {
  const res = await fetch("/api/runs/mine.php", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to load runs.");
  return ((data as { runs?: SavedRun[] }).runs || []);
};

export const saveRun = async (body: {
  label?: string;
  sources?: string[];
  summary: SavedRun["summary"];
  exceptionTypes?: string[];
  workflow?: Record<string, { status: string; note?: string; assignee?: string }>;
  payloadB64?: string;
  brandId?: string;
}): Promise<SavedRun> => {
  const res = await fetch("/api/runs/mine.php", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to save run.");
  return (data as { run: SavedRun }).run;
};

export const deleteRun = async (id: string): Promise<void> => {
  const res = await fetch("/api/runs/mine.php", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || "Failed to delete run.");
  }
};

export const getMyTeam = async () => {
  const res = await fetch("/api/teams/mine.php", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to load team.");
  return data as {
    team: TeamInfo | null;
    members: Array<{ uid: string; name: string; email: string; isOwner: boolean }>;
    teamPro: boolean;
  };
};

export const teamAction = async (body: Record<string, unknown>) => {
  const res = await fetch("/api/teams/mine.php", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Team action failed.");
  return data;
};

export const fetchShopifyOrders = async (shop: string, accessToken: string) => {
  const res = await fetch("/api/connectors/shopify.php", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ shop, accessToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Shopify fetch failed.");
  return data as { rows: Record<string, unknown>[]; count: number; csvHint?: string };
};

export const fetchRazorpayPayments = async (from?: string, to?: string) => {
  const res = await fetch("/api/connectors/razorpay.php", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Razorpay fetch failed.");
  return data as { rows: Record<string, unknown>[]; count: number; csvHint?: string };
};

export const fetchHealth = async () => {
  const res = await fetch("/api/health.php", { headers: { Accept: "application/json" } });
  return res.json();
};

export type ExceptionExplain = {
  summary: string;
  likelyCauses: string[];
  suggestedActions: string[];
  source: "rules" | "ai" | string;
  type?: string;
  amountInr?: number;
  ref?: string;
};

export const explainException = async (
  exception: Record<string, unknown>,
  useAi = true
): Promise<{ explain: ExceptionExplain; aiConfigured: boolean }> => {
  const res = await fetch("/api/ai/explain-exception.php", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ exception, useAi }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Explain failed.");
  return data as { explain: ExceptionExplain; aiConfigured: boolean };
};

export const checkRiskAlert = async (body: {
  label?: string;
  summary: { amountAtRiskPaise: number; exceptionCount: number };
  runId?: string;
}) => {
  const res = await fetch("/api/alerts/check.php", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Alert check failed.");
  return data as {
    alert: { sent: boolean; channels: string[]; reason?: string };
    settings: { enabled: boolean; thresholdInr: number };
  };
};
