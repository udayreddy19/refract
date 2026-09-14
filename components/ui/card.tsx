import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  title,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("glass rounded-[20px] p-5", className)}>
      {(title || action) && (
        <div className="relative z-[1] mb-4 flex items-center justify-between gap-3">
          {title && (
            <h3 className="font-display text-base font-semibold tracking-tight text-[var(--t-hi)]">
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
