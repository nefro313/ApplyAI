import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/**
 * Base shimmer block. Compose these for richer placeholders that mirror the
 * shape of the content that's loading, so layouts don't jump when data lands.
 * Pulls the same pulse + slate tones used by HistorySkeleton / LoadingPanel.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        "animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-700/50",
        className,
      )}
    />
  );
}

/** A stack of shimmer lines faking a paragraph (last line shorter). */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("space-y-2.5", className)}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

/**
 * A Card-shaped placeholder: an optional icon + title/subtitle header followed
 * by paragraph lines. Matches the resting shape of most result cards.
 */
export function CardSkeleton({
  lines = 4,
  header = true,
  className,
}: {
  lines?: number;
  header?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("space-y-5", className)}>
      {header && (
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      )}
      <SkeletonText lines={lines} />
    </Card>
  );
}
