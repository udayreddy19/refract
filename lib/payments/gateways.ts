"use client";

export type PaymentProvider = "RAZORPAY" | "CASHFREE";

export type ProvidersResponse = {
  providers: Array<{
    id: PaymentProvider;
    label: string;
    enabled: boolean;
    environment?: string;
    keyId?: string;
  }>;
  primary: PaymentProvider | null;
  demoMode: boolean;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (resp: unknown) => void) => void;
    };
    Cashfree?: new (opts: { mode: string }) => {
      checkout: (opts: { paymentSessionId: string; redirectTarget?: string }) => Promise<unknown>;
    };
  }
}

export function loadRazorpaySdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });
}

export function loadCashfreeSdk(): Promise<NonNullable<typeof window.Cashfree>> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.Cashfree) return Promise.resolve(window.Cashfree);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => {
      if (window.Cashfree) resolve(window.Cashfree);
      else reject(new Error("Cashfree SDK missing after load"));
    };
    script.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(opts: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  name: string;
  email?: string;
  mobile?: string;
  description?: string;
}): Promise<{
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}> {
  await loadRazorpaySdk();
  if (!window.Razorpay) throw new Error("Razorpay SDK unavailable");

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: opts.keyId,
      amount: opts.amountPaise,
      currency: "INR",
      name: "ReconcileX",
      description: opts.description || "Wallet top-up",
      order_id: opts.orderId,
      prefill: {
        name: opts.name,
        email: opts.email || "",
        contact: opts.mobile || "",
      },
      theme: { color: "#0a0b10" },
      handler: (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
    });
    rzp.on("payment.failed", (resp: unknown) => {
      const msg =
        (resp as { error?: { description?: string } })?.error?.description ||
        "Payment failed";
      reject(new Error(msg));
    });
    rzp.open();
  });
}

export async function openCashfreeCheckout(opts: {
  paymentSessionId: string;
  environment?: string;
}): Promise<void> {
  const Cashfree = await loadCashfreeSdk();
  const cashfree = new Cashfree({
    mode: opts.environment === "production" ? "production" : "sandbox",
  });
  await cashfree.checkout({
    paymentSessionId: opts.paymentSessionId,
    redirectTarget: "_modal",
  });
}
