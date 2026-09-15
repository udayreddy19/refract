"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/30 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] border border-[var(--btn-primary-border)] shadow-[var(--s-btn-w)] hover:bg-[var(--btn-primary-bg-hover)] hover:-translate-y-0.5 hover:shadow-[var(--s-btn-wh)] active:scale-[0.97]",
        secondary:
          "bg-[var(--surface)] text-[var(--t-hi)] border border-[var(--g-border)] shadow-sm hover:bg-[var(--brand-soft)] hover:text-[var(--brand-deep)] hover:-translate-y-px",
        outline:
          "border border-[var(--g-border)] bg-transparent text-[var(--t-hi)] hover:bg-[var(--brand-soft)]",
        ghost:
          "text-[var(--t-mid)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand-deep)] rounded-[12px]",
        danger:
          "bg-[var(--red)] text-white border border-[var(--red-border)] hover:opacity-95",
        success:
          "bg-[var(--green)] text-white border border-[var(--green-border)] hover:opacity-95",
      },
      size: {
        sm: "h-9 px-4 text-[13px]",
        md: "h-11 px-5",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {(variant === "primary" || !variant) && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-[inherit] bg-gradient-to-b from-white/25 to-transparent"
        />
      )}
      {loading && <Loader2 className="relative h-4 w-4 animate-spin" aria-hidden />}
      <span className="relative">{children}</span>
    </button>
  )
);
Button.displayName = "Button";
