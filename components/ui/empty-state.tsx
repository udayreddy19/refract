import { Inbox } from "lucide-react";

export function EmptyState({
  title = "There are no records to display",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--g-border)] bg-[var(--brand-soft)]">
        <Inbox className="h-6 w-6 text-[var(--brand)]" />
      </div>
      <p className="text-sm font-medium text-[var(--t-hi)]">{title}</p>
      {description && <p className="mt-1 text-sm text-[var(--t-mid)]">{description}</p>}
    </div>
  );
}
