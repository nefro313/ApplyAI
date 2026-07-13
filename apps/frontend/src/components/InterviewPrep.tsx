"use client";

import { ChevronDown, MessageSquareQuote } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingPanel } from "@/components/ui/LoadingPanel";
import { cn } from "@/lib/utils";
import { generateInterviewPrep } from "@/services/api";
import type { InterviewPrep as Prep, InterviewQuestion } from "@applyai/types";

type Props = { pipelineId: string; initial?: Prep | null };

const CATEGORIES: { key: keyof Prep; label: string }[] = [
  { key: "behavioral", label: "Behavioral" },
  { key: "technical", label: "Technical" },
  { key: "role_specific", label: "Role specific" },
];

export function InterviewPrep({ pipelineId, initial }: Props) {
  const [prep, setPrep] = useState<Prep | null>(initial ?? null);
  // The pipeline pre-computes this and ships it on the result, so we render
  // instantly when `initial` is present and only fetch as a fallback.
  const [busy, setBusy] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  // Single-open accordion: only one question's answer is expanded at a time.
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await generateInterviewPrep(pipelineId);
    setBusy(false);
    if (err || !data) setError(err ?? "Could not generate interview prep");
    else setPrep(data);
  };

  useEffect(() => {
    if (!initial) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId]);

  if (!prep) {
    if (busy) {
      return (
        <LoadingPanel
          title="Building your interview prep"
          subtitle="Drafting likely questions and suggested answers from your resume and the role."
        />
      );
    }
    return (
      <Card className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <MessageSquareQuote className="h-4 w-4 text-violet-500 dark:text-violet-400" />
          Interview prep packet
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-rose-500">{error}</span>}
          <Button onClick={load} variant="outline">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <MessageSquareQuote className="h-4 w-4 text-violet-500 dark:text-violet-400" />
        Interview prep
      </div>

      {CATEGORIES.map(({ key, label }) => {
        const questions = prep[key] as InterviewQuestion[];
        if (!questions || questions.length === 0) return null;
        return (
          <section key={key as string}>
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {label}
            </h3>
            <ul className="mt-2 space-y-2">
              {questions.map((q, i) => {
                const id = `${key as string}-${i}`;
                return (
                  <QuestionItem
                    key={i}
                    q={q}
                    open={openId === id}
                    onToggle={() =>
                      setOpenId((cur) => (cur === id ? null : id))
                    }
                  />
                );
              })}
            </ul>
          </section>
        );
      })}

      {prep.questions_to_ask.length > 0 && (
        <section>
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Ask them
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
            {prep.questions_to_ask.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}

      {prep.watch_outs.length > 0 && (
        <section>
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Watch outs
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-300">
            {prep.watch_outs.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}

function QuestionItem({
  q,
  open,
  onToggle,
}: {
  q: InterviewQuestion;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/50">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="ring-focus flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0 text-sm font-medium text-slate-800 dark:text-slate-200">{q.question}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-200 dark:border-slate-700/60 px-4 py-3 text-sm">
          <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
            {q.suggested_answer}
          </p>
          {q.anchor && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Anchor:</span> {q.anchor}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
