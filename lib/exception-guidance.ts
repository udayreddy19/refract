import type { ExceptionType } from "@/lib/engine/types";

export const EXCEPTION_NEXT_STEPS: Record<
  ExceptionType,
  { title: string; steps: string[] }
> = {
  SETTLED_NO_ORDER: {
    title: "Settled with no matching order",
    steps: [
      "Confirm the settlement UTR / payment ID in your gateway dashboard.",
      "Search the store for alternate order IDs, edits, or merged orders.",
      "If it is a COD remittance, check shipping partner payout reports.",
      "Raise a gateway ticket only after confirming no local order exists.",
    ],
  },
  PAID_NOT_SETTLED: {
    title: "Paid but not yet settled",
    steps: [
      "Check settlement T+N for this payment method (UPI/card/netbanking).",
      "Confirm the payment is Captured / Success, not Authorized-only.",
      "Look for refunds or chargebacks that cancelled the payout.",
      "Re-export settlements after the next payout cycle and re-run recon.",
    ],
  },
  AMOUNT_MISMATCH: {
    title: "Amount mismatch",
    steps: [
      "Compare order gross vs payment amount (partial capture / tip / COD).",
      "Check multi-currency or rounding differences in both CSVs.",
      "Verify discounts, gift cards, and store credit were not double-counted.",
      "Document the diff and adjust books if the gateway amount is correct.",
    ],
  },
  FEE_ANOMALY: {
    title: "Fee anomaly",
    steps: [
      "Compare charged MDR vs your contracted rate for that method.",
      "Confirm GST on fees is treated consistently in both exports.",
      "Check for international cards or EMI which carry higher fees.",
      "Escalate recurring overcharges to your gateway account manager.",
    ],
  },
  REFUND_MISMATCH: {
    title: "Refund mismatch",
    steps: [
      "Match refund IDs across store, gateway, and settlement lines.",
      "Confirm partial refunds vs full cancellations.",
      "Ensure refund fees/reversals are not treated as new payments.",
      "Update inventory/accounting once both sides agree.",
    ],
  },
  SETTLEMENT_OVERDUE: {
    title: "Settlement overdue",
    steps: [
      "Confirm expected settlement date from the gateway schedule.",
      "Check for on-hold / under-review payments in the gateway.",
      "Verify bank account KYC / beneficiary details are current.",
      "Contact support with payment IDs older than your SLA window.",
    ],
  },
};
