"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--t-mid)]">
            {label}
            {props.required && <span className="ml-0.5 text-[var(--red)]">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "flex h-11 w-full rounded-[14px] border border-[var(--g-border)] bg-[var(--input-bg)] px-3.5 text-sm text-[var(--t-hi)] placeholder:text-[var(--t-low)] transition-colors focus:border-[var(--brand)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-[var(--red)]/50 focus:border-[var(--red)] focus:ring-[var(--red)]/20",
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-[var(--red)]" role="alert">
            {error}
          </p>
        )}
        {hint && !error && <p className="text-xs text-[var(--t-low)]">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
