import { cn } from "@/lib/utils";

/** Yükleme yer tutucusu. Ekran okuyucular etiketi duyar; görsel blokların hareketi azaltılmış harekette durur. */
export function ListSkeleton({ label, rows = 3, className }: { label: string; rows?: number; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("skeleton-list grid gap-3 py-2", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} aria-hidden="true" className="skeleton-row">
          <span className="skeleton h-10 w-10 rounded-lg" />
          <span className="grid gap-2"><span className="skeleton h-3.5 w-2/5" /><span className="skeleton h-3 w-3/4" /></span>
        </div>
      ))}
    </div>
  );
}
