"use client";

import { ChevronDown, Loader2, ThumbsUp, UserCheck } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingPanel } from "@/components/ui/LoadingPanel";
import { getRecruiterReview } from "@/services/api";
import type {
  HiringRecommendation,
  RecruiterReview as Review,
} from "@applyai/types";

type Props = {
  pipelineId: string;
  initial?: Review | null;
  /** Lifts a freshly generated review up to the parent so it survives tab switches. */
  onGenerated?: (review: Review) => void;
};

const REC_LABEL: Record<HiringRecommendation, string> = {
  strong_yes: "Strong yes",
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
};

const REC_TONE: Record<HiringRecommendation, "matched" | "info" | "warning" | "missing"> = {
  strong_yes: "matched",
  yes: "info",
  maybe: "warning",
  no: "missing",
};

export function RecruiterReview({ pipelineId, initial, onGenerated }: Props) {
  // Seed from the cached value on the result, if it was already generated.
  const [data, setData] = useState<Review | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Compact by default on mobile — strengths/concerns are behind "Read full
  // review" so the Overview tab stays short.
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    setBusy(true);
    setError(null);
    const { data: res, error: err } = await getRecruiterReview(pipelineId);
    setBusy(false);
    if (err || !res) setError(err ?? "Could not get a recruiter review");
    else {
      setData(res);
      onGenerated?.(res);
    }
  };

  if (busy) {
    return (
      <LoadingPanel
        title="Reviewing like a recruiter"
        subtitle="Weighing your resume against the role to call out strengths and concerns."
      />
    );
  }

  if (!data) {
    return (
      <Card className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <UserCheck className="h-4 w-4 text-violet-500 dark:text-violet-400" />
          See it through a recruiter&apos;s eyes
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-rose-500">{error}</span>}
          <Button onClick={load} disabled={busy} variant="outline">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Reviewing…
              </>
            ) : (
              "Generate"
            )}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <UserCheck className="h-4 w-4 text-violet-500 dark:text-violet-400" />
          Recruiter review
        </div>
        <Badge tone={REC_TONE[data.hiring_recommendation]}>
          {REC_LABEL[data.hiring_recommendation]}
        </Badge>
      </div>

      {data.verdict && (
        <p className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
          {data.verdict}
        </p>
      )}

      {(data.strengths.length > 0 || data.concerns.length > 0) && (
        <>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="ring-focus inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-violet-600 dark:text-violet-400"
          >
            {expanded ? "Hide full review" : "Read full review"}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>

          {expanded && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  Strengths
                </p>
                <ul className="space-y-1.5">
                  {data.strengths.map((s, i) => (
                    <li
                      key={i}
                      className="text-sm text-slate-700 dark:text-slate-300"
                    >
                      • {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  Concerns
                </p>
                <ul className="space-y-1.5">
                  {data.concerns.map((c, i) => (
                    <li
                      key={i}
                      className="text-sm text-slate-700 dark:text-slate-300"
                    >
                      • {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
