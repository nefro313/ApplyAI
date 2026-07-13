"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";
import type { AtsAnalysis } from "@applyai/types";

type Props = {
  original: AtsAnalysis | null;
  tailored: AtsAnalysis | null;
};

type Side = "original" | "tailored";

function scoreColor(score: number) {
  if (score >= 80) return "from-emerald-500 to-teal-500";
  if (score >= 60) return "from-amber-500 to-orange-500";
  return "from-rose-500 to-pink-500";
}

function scoreLabel(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Decent";
  if (score >= 40) return "Weak";
  return "Poor";
}

const BREAKDOWN_LABELS: Record<string, string> = {
  keyword_match: "Keywords",
  skills_match: "Skills",
  experience_match: "Experience",
  education_match: "Education",
  formatting: "Formatting",
};

export function AtsComparison({ original, tailored }: Props) {
  const [side, setSide] = useState<Side>("tailored");

  if (!original && !tailored) return null;

  const delta =
    original && tailored ? tailored.score - original.score : null;

  return (
    <Card className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Sparkles className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            ATS scorecard
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            How each resume scores against this job description. Lower is the
            uploaded original; higher is the tailored rewrite.
          </p>
        </div>
        {delta !== null && (
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
              delta >= 0
                ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300",
            )}
          >
            {delta >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {delta >= 0 ? "+" : ""}
            {delta} points after tailoring
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ScoreColumn
          title="Original resume"
          subtitle="As uploaded"
          analysis={original}
          accent="from-slate-500 to-slate-700"
        />
        <ScoreColumn
          title="Tailored resume"
          subtitle="ApplyAI rewrite"
          analysis={tailored}
          accent="from-violet-500 to-indigo-500"
          comparison={original}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 dark:border-slate-700/60 pt-5">
        <div className="flex items-center justify-between gap-4">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Keyword detail
          </h4>
          <Tabs<Side>
            value={side}
            onValueChange={setSide}
            options={[
              { value: "original", label: "Original" },
              { value: "tailored", label: "Tailored" },
            ]}
          />
        </div>
        <KeywordPanel analysis={side === "original" ? original : tailored} />
      </div>

      {(() => {
        const active = side === "original" ? original : tailored;
        return active ? <InsightsPanel analysis={active} /> : null;
      })()}
    </Card>
  );
}

function ScoreColumn({
  title,
  subtitle,
  analysis,
  accent,
  comparison,
}: {
  title: string;
  subtitle: string;
  analysis: AtsAnalysis | null;
  accent: string;
  comparison?: AtsAnalysis | null;
}) {
  if (!analysis) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/60 p-6 text-sm text-slate-500 dark:text-slate-400">
        Not available
      </div>
    );
  }

  const breakdown = analysis.breakdown;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/40 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {subtitle}
          </p>
        </div>
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 15 }}
          className={cn(
            "flex h-20 w-20 flex-col items-center justify-center rounded-full bg-gradient-to-br text-white shadow-md",
            scoreColor(analysis.score),
            accent,
          )}
        >
          <span className="text-2xl font-bold leading-none">
            {analysis.score}
          </span>
          <span className="text-[10px] uppercase tracking-wider opacity-90">
            {scoreLabel(analysis.score)}
          </span>
        </motion.div>
      </div>

      {analysis.summary && (
        <p className="mt-4 text-xs italic text-slate-600 dark:text-slate-400">
          “{analysis.summary}”
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {Object.entries(BREAKDOWN_LABELS).map(([key, label]) => {
          const value = (breakdown[key as keyof typeof breakdown] as number) ?? 0;
          const compareValue = comparison?.breakdown?.[
            key as keyof typeof breakdown
          ] as number | undefined;
          const diff =
            compareValue !== undefined ? value - compareValue : null;
          return (
            <li key={key} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>{label}</span>
                <span className="flex items-center gap-2">
                  {diff !== null && diff !== 0 && (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        diff > 0
                          ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300",
                      )}
                    >
                      {diff > 0 ? "+" : ""}
                      {diff}
                    </span>
                  )}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {value}
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700/60">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r",
                    scoreColor(value),
                  )}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function KeywordPanel({ analysis }: { analysis: AtsAnalysis | null }) {
  if (!analysis) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        No data for this resume.
      </p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Matched ({analysis.matched_keywords.length})
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {analysis.matched_keywords.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">None.</p>
          ) : (
            analysis.matched_keywords.map((k) => (
              <Badge key={k} tone="matched">
                {k}
              </Badge>
            ))
          )}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Missing ({analysis.missing_keywords.length})
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {analysis.missing_keywords.length === 0 ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Nothing missing.
            </p>
          ) : (
            analysis.missing_keywords.map((k) => (
              <Badge key={k} tone="missing">
                {k}
              </Badge>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function InsightsPanel({ analysis }: { analysis: AtsAnalysis }) {
  const items: { title: string; tone: string; values: string[] }[] = [
    {
      title: "Strengths",
      tone: "text-emerald-600 dark:text-emerald-400",
      values: analysis.strengths,
    },
    {
      title: "Weaknesses",
      tone: "text-rose-600 dark:text-rose-400",
      values: analysis.weaknesses,
    },
    {
      title: "Recommendations",
      tone: "text-violet-600 dark:text-violet-400",
      values: analysis.recommendations,
    },
  ].filter((item) => item.values.length > 0);

  if (items.length === 0) return null;

  return (
    <div className="grid gap-4 border-t border-slate-200 dark:border-slate-700/60 pt-4 sm:grid-cols-2 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.title}>
          <p
            className={cn(
              "flex items-center gap-1 text-xs font-medium uppercase tracking-wider",
              item.tone,
            )}
          >
            <ArrowRight className="h-3 w-3" />
            {item.title}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {item.values.map((v, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-slate-400 dark:text-slate-500">•</span>
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
