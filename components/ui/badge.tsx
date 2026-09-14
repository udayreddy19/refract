import { cn } from "@/lib/utils";
import type { TransactionStatus } from "@/lib/types";

const statusStyles: Record<TransactionStatus, string> = {
  success: "bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-border)]",
  failed: "bg-[var(--red-bg)] text-[var(--red)] border border-[var(--red-border)]",
  pending: "bg-[var(--yellow-bg)] text-[var(--yellow)] border border-[var(--yellow-border)]",
  refund: "bg-[var(--blue-bg)] text-[var(--blue)] border border-white/10",
  processing: "bg-[var(--yellow-bg)] text-[var(--yellow)] border border-[var(--yellow-border)]",
};

const statusLabels: Record<TransactionStatus, string> = {
  success: "Success",
  failed: "Failed",
  pending: "Pending",
  refund: "Refund",
  processing: "Processing",
};

export function Badge({
  status,
  children,
  className,
}: {
  status?: TransactionStatus;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        status ? statusStyles[status] : "bg-white/5 text-[var(--t-mid)] border border-white/10",
        className
      )}
    >
      {children ?? (status ? statusLabels[status] : null)}
    </span>
  );
}
