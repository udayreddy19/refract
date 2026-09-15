import type { ProvidersResponse, PaymentProvider } from "@/lib/payments/gateways";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function payflowFetch<T>(
  path: string,
  init?: RequestInit & { idToken?: string }
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (init?.idToken) headers.Authorization = `Bearer ${init.idToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const paymentService = {
  async getProviders(): Promise<ProvidersResponse> {
    return payflowFetch<ProvidersResponse>("/api/payflow/providers.php");
  },

  async syncSession(payload: {
    agentId: string;
    name: string;
    email: string;
    mobile?: string;
    idToken?: string;
    passcode?: string;
  }) {
    return payflowFetch<{ success: boolean; balance?: number }>("/api/payflow/login.php", {
      method: "POST",
      body: JSON.stringify(payload),
      idToken: payload.idToken,
    });
  },

  async createOrder(payload: {
    amount: number;
    provider: PaymentProvider;
    customerName: string;
    mobile: string;
    email?: string;
    category?: string;
    idToken?: string;
  }) {
    return payflowFetch<{
      success: boolean;
      demoMode?: boolean;
      provider: PaymentProvider;
      depositId: string;
      orderId: string;
      amount: number;
      amountPaise: number;
      keyId?: string;
      paymentSessionId?: string;
      environment?: string;
    }>("/api/payflow/wallet/create-order.php", {
      method: "POST",
      body: JSON.stringify(payload),
      idToken: payload.idToken,
    });
  },

  async verify(payload: {
    provider: PaymentProvider;
    depositId: string;
    orderId: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    idToken?: string;
  }) {
    return payflowFetch<{
      success: boolean;
      balance: number;
      utr?: string;
      demoMode?: boolean;
    }>("/api/payflow/wallet/verify.php", {
      method: "POST",
      body: JSON.stringify(payload),
      idToken: payload.idToken,
    });
  },
};
