"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-30",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] border-t border-[var(--btn-primary-border-top)] border-x border-[var(--btn-primary-border)] border-b border-[var(--btn-primary-border-bottom)] shadow-[var(--s-btn-w)] hover:bg-[var(--btn-primary-bg-hover)] hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[var(--s-btn-wh)] active:scale-[0.97]",
        secondary:
          "bg-white/[0.07] text-[var(--t-mid)] backdrop-blur-md border-t border-white/20 border-x border-white/10 border-b border-white/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.40)] hover:bg-white/12 hover:text-[var(--t-hi)] hover:-translate-y-px",
        outline:
          "border border-white/20 bg-transparent text-[var(--t-hi)] hover:bg-white/10",
        ghost: "text-[var(--t-mid)] hover:bg-white/[0.06] hover:text-[var(--t-hi)] rounded-[10px]",
        danger:
          "bg-[var(--red)]/90 text-white border border-[var(--red-border)] hover:bg-[var(--red)]",
        success:
          "bg-[var(--green)]/90 text-[#04120c] border border-[var(--green-border)] hover:bg-[var(--green)]",
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
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-[inherit] bg-gradient-to-b from-white/20 to-transparent"
        />
      )}
      {loading && <Loader2 className="relative h-4 w-4 animate-spin" aria-hidden />}
      <span className="relative">{children}</span>
    </button>
  )
);
Button.displayName = "Button";
