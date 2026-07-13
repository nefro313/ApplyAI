import { Card } from "@/components/ui/Card";

/**
 * Placeholder list shown while history is loading (or while a delete is in
 * flight). Mirrors the real row layout — a title/subtitle block on the left
 * and badge + action chips on the right — so the page doesn't jump when the
 * data arrives. Replaces the old centered spinner.
 */
export function HistorySkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="space-y-3" aria-hidden role="status" aria-label="Loading applications">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i}>
          <Card className="flex items-center justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-700/50" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200/60 dark:bg-slate-700/40" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-14 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
              <div className="h-6 w-16 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-700/50" />
              <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-700/50" />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
