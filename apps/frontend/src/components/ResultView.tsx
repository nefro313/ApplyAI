"use client";

import { motion } from "framer-motion";
import { ArrowRight, Lightbulb, TrendingUp } from "lucide-react";

import { Accordion } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { PipelineResult } from "@applyai/types";

type Props = {
  result: PipelineResult;
  // Jumps to the Apply tab, where the download buttons live.
  onOpenApplyTab?: () => void;
};

function scoreTone(score: number) {
  if (score >= 80)
    return {
      ring: "ring-emerald-200",
      bg: "bg-gradient-to-br from-emerald-500 to-teal-500",
      label: "Strong match",
    };
  if (score >= 60)
    return {
      ring: "ring-amber-200",
      bg: "bg-gradient-to-br from-amber-500 to-orange-500",
      label: "Decent match",
    };
  return {
    ring: "ring-rose-200",
    bg: "bg-gradient-to-br from-rose-500 to-pink-500",
    label: "Needs work",
  };
}

function asStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.filter((v): v is string => typeof v === "string");
}

export function ResultView({ result, onOpenApplyTab }: Props) {
  const score = result.ats_score.final_score;
  const tone = scoreTone(score);

  const matchingSkills = asStringArray(result.analyst_report["matching_skills"]);
  const transferable = asStringArray(
    result.analyst_report["transferable_experiences"],
  );

  // Before/after ATS improvement from the LLM scorecards (when present).
  const originalScore = result.original_ats?.score ?? null;
  const tailoredScore = result.tailored_ats?.score ?? null;
  const improvement =
    originalScore !== null && tailoredScore !== null
      ? tailoredScore - originalScore
      : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr]">
        <Card className="flex flex-col items-center gap-3 text-center">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Job match score
          </span>
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 15 }}
            className={cn(
              "flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg ring-4 sm:h-32 sm:w-32 sm:ring-8",
              tone.bg,
              tone.ring,
            )}
          >
            <div className="text-center">
              <div className="text-3xl font-bold leading-none sm:text-4xl">{score}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider opacity-90">
                / 100
              </div>
            </div>
          </motion.div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{tone.label}</p>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            How well your{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              tailored resume
            </span>{" "}
            matches the{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {result.role_title}
            </span>{" "}
            job description at {result.company_name}.
          </p>
        </Card>

        <Card className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Tailored deliverables
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              The rewritten resume, plus the cover letter if you asked for
              one.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 dark:border-violet-800/40 bg-violet-50/60 dark:bg-violet-500/5 px-4 py-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Download your tailored resume
              {result.cover_letter_pdf_url ? " and cover letter" : ""} from
              the{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Apply
              </span>{" "}
              tab.
            </p>
            {onOpenApplyTab && (
              <button
                type="button"
                onClick={onOpenApplyTab}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 transition hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200 ring-focus rounded-md"
              >
                Open Apply tab
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 dark:border-slate-700/60 pt-4">
            <Stat
              label="Matched keywords"
              value={result.ats_score.matched_keywords.length}
              tone="emerald"
            />
            <Stat
              label="Missing keywords"
              value={result.ats_score.missing_keywords.length}
              tone="rose"
            />
          </div>

          {improvement !== null && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-500/5 px-4 py-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                <TrendingUp className="h-4 w-4" />
                Resume improvement
              </span>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Original{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {originalScore}%
                </span>{" "}
                → Tailored{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {tailoredScore}%
                </span>
              </span>
              <span
                className={cn(
                  "text-sm font-bold",
                  improvement >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400",
                )}
              >
                {improvement >= 0 ? "+" : ""}
                {improvement}
              </span>
            </div>
          )}
        </Card>
      </div>

      {(matchingSkills.length > 0 || transferable.length > 0) && (
        <Card className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Analyst insights
          </div>
          <Accordion
            items={[
              ...(matchingSkills.length > 0
                ? [
                    {
                      id: "matching",
                      title: "Matching skills",
                      subtitle: `${matchingSkills.length} matched`,
                      content: (
                        <div className="flex flex-wrap gap-1.5">
                          {matchingSkills.map((s) => (
                            <Badge key={s} tone="info">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      ),
                    },
                  ]
                : []),
              ...(transferable.length > 0
                ? [
                    {
                      id: "transferable",
                      title: "Transferable experience",
                      subtitle: `${transferable.length} item${transferable.length === 1 ? "" : "s"}`,
                      content: (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
                          {transferable.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "rose";
}) {
  const palette =
    tone === "emerald"
      ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
      : "border-rose-200 dark:border-rose-800/40 bg-rose-50/60 dark:bg-rose-500/5 text-rose-700 dark:text-rose-300";
  return (
    <div className={cn("rounded-2xl border px-4 py-3", palette)}>
      <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
