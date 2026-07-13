"use client";

import { Loader2 } from "lucide-react";

import { Card } from "@/components/ui/Card";

type Props = {
  title: string;
  subtitle?: string;
};

/**
 * A calm, centered loading state for tabs whose content is pre-computed by the
 * pipeline and fetched on mount. Reads clearly as "working", not as a button the
 * user is expected to click — and shimmer rows hint at the shape that's coming.
 */
export function LoadingPanel({ title, subtitle }: Props) {
  return (
    <Card className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="space-y-2.5">
        {[100, 92, 78].map((w, i) => (
          <div
            key={i}
            style={{ width: `${w}%` }}
            className="h-3 animate-pulse rounded-full bg-slate-200/70 dark:bg-slate-700/50"
          />
        ))}
      </div>
    </Card>
  );
}
