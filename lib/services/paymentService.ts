import type { ProvidersResponse, PaymentProvider } from "@/lib/payments/gateways";
import { delay } from "@/lib/utils";

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

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
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
    try {
      return await payflowFetch<ProvidersResponse>("/api/payflow/providers.php");
    } catch {
      // Local / static fallback when PHP API is unreachable
      return {
        providers: [
          { id: "RAZORPAY", label: "Razorpay", enabled: true, keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID },
          { id: "CASHFREE", label: "Cashfree", enabled: true, environment: "sandbox" },
        ],
        primary: "RAZORPAY",
        demoMode: true,
      };
    }
  },

  async syncSession(payload: {
    agentId: string;
    name: string;
    email: string;
    mobile?: string;
    idToken?: string;
  }) {
    try {
      return await payflowFetch<{ success: boolean }>("/api/payflow/login.php", {
        method: "POST",
        body: JSON.stringify(payload),
        idToken: payload.idToken,
      });
    } catch {
      return { success: false };
    }
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
    try {
      return await payflowFetch<{
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
    } catch (e) {
      // Demo fallback — simulated order for local UI testing
      await delay(600);
      return {
        success: true,
        demoMode: true,
        provider: payload.provider,
        depositId: `dep_demo_${Date.now()}`,
        orderId: `order_demo_${Date.now()}`,
        amount: payload.amount,
        amountPaise: Math.round(payload.amount * 100),
        keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_demo",
        paymentSessionId: `session_demo_${Date.now()}`,
        environment: "sandbox",
      };
    }
  },

  async verify(payload: {
    provider: PaymentProvider;
    depositId: string;
    orderId: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    idToken?: string;
  }) {
    try {
      return await payflowFetch<{
        success: boolean;
        balance: number;
        utr?: string;
        demoMode?: boolean;
      }>("/api/payflow/wallet/verify.php", {
        method: "POST",
        body: JSON.stringify(payload),
        idToken: payload.idToken,
      });
    } catch {
      await delay(800);
      return {
        success: true,
        demoMode: true,
        balance: 0,
        utr: `DEMO${Date.now()}`,
      };
    }
  },
};
