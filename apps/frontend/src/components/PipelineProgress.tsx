"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  MinusCircle,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  getPipelineStatus,
  listMyPipelines,
  PIPELINE_FAILED_MESSAGE,
} from "@/services/api";
import { cn, formatClock, formatDuration } from "@/lib/utils";
import type { AgentStatus, OverallStatus, StepState } from "@applyai/types";

type DisplayStep = {
  key: string;
  label: string;
  hidden?: boolean;
};

const POLL_INTERVAL_MS = 1500;

// Server-side timing anchors (epoch ms) driving the elapsed clock.
type TimingAnchors = {
  startedAt: number | null;
  analysisEndedAt: number | null;
  generationStartedAt: number | null;
};

const parseTs = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
};

/**
 * Elapsed processing seconds: the analysis-phase span (frozen once the review
 * pause begins) plus, when the generation phase has started, the live span
 * since `generation_started_at`. The review think-time is excluded, so after
 * the user applies changes the clock resumes from the analysis total instead
 * of restarting at zero — and the value survives remounts/reloads. Falls back
 * to a plain +1 tick for docs that predate the anchors; monotonic so minor
 * client/server clock skew can't tick the display backwards.
 */
function computeElapsed(a: TimingAnchors, prev: number): number {
  if (a.startedAt == null) return prev + 1;
  const analysisEnd = a.analysisEndedAt ?? Date.now();
  let secs = (analysisEnd - a.startedAt) / 1000;
  if (a.generationStartedAt != null) {
    secs += (Date.now() - a.generationStartedAt) / 1000;
  }
  return Math.max(prev, Math.round(secs));
}

const buildSteps = (
  wantCoverLetter: boolean,
  wantEmail: boolean,
): DisplayStep[] => {
  const steps: DisplayStep[] = [
    { key: "jd_scraper", label: "Reading job description" },
    { key: "jd_parser", label: "Understanding requirements" },
    { key: "resume_loader", label: "Loading your resume", hidden: true },
    { key: "resume_analyst", label: "Analysing your resume" },
    { key: "ats_analyst", label: "Scoring your current resume" },
    { key: "resume_writer", label: "Writing tailored resume" },
    { key: "ats_tailored", label: "Scoring the tailored resume" },
    { key: "document_builder", label: "Building documents" },
  ];
  if (wantCoverLetter) {
    steps.push({ key: "cover_letter", label: "Writing cover letter" });
  }
  if (wantEmail) {
    steps.push({ key: "email_drafter", label: "Drafting email" });
  }
  steps.push({ key: "interview_prep", label: "Preparing interview questions" });
  steps.push({ key: "skill_roadmap", label: "Mapping skill gaps" });
  return steps;
};

type Props = {
  pipelineId: string;
  wantCoverLetter: boolean;
  wantEmail: boolean;
  onDone: () => void;
  onFailed: (error: string | null) => void;
  onAwaitingReview?: () => void;
};

export function PipelineProgress({
  pipelineId,
  wantCoverLetter,
  wantEmail,
  onDone,
  onFailed,
  onAwaitingReview,
}: Props) {
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({});
  const [overall, setOverall] = useState<OverallStatus>("started");
  const [inferredCoverLetter, setInferredCoverLetter] = useState(wantCoverLetter);
  const [inferredEmail, setInferredEmail] = useState(wantEmail);
  // Live elapsed counter (analysis + generation compute, review pause
  // excluded), plus how long the user's previous application took as a rough
  // "this is what to expect" hint.
  const [elapsed, setElapsed] = useState(0);
  const [prevDuration, setPrevDuration] = useState<number | null>(null);
  const anchorsRef = useRef<TimingAnchors>({
    startedAt: null,
    analysisEndedAt: null,
    generationStartedAt: null,
  });

  const onDoneRef = useRef(onDone);
  const onFailedRef = useRef(onFailed);
  const onAwaitingReviewRef = useRef(onAwaitingReview);
  onDoneRef.current = onDone;
  onFailedRef.current = onFailed;
  onAwaitingReviewRef.current = onAwaitingReview;

  const steps = buildSteps(inferredCoverLetter, inferredEmail).filter(
    (s) => !s.hidden,
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      const { data, error } = await getPipelineStatus(pipelineId);
      if (cancelled) return;

      if (error || !data) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
        return;
      }

      const nextStatuses: Record<string, AgentStatus> = {};
      for (const step of data.steps ?? []) {
        if (step.name) nextStatuses[step.name] = step;
      }
      setStatuses(nextStatuses);
      setOverall(data.overall_status);

      // Snap the elapsed clock to the server anchors as soon as we have them,
      // so a remount mid-generation shows the true total immediately.
      if (data.started_at) {
        anchorsRef.current = {
          startedAt: parseTs(data.started_at),
          analysisEndedAt: parseTs(data.analysis_ended_at),
          generationStartedAt: parseTs(data.generation_started_at),
        };
        setElapsed((e) => computeElapsed(anchorsRef.current, e));
      }

      // The backend doesn't echo back the original want_cover_letter /
      // want_email flags. Infer them from the steps array: if a step entry
      // exists (even as "skipped"), the orchestrator considered it. Promote
      // the toggle to true only when the step actually ran.
      const coverStep = nextStatuses["cover_letter"];
      if (coverStep && coverStep.state !== "skipped") {
        setInferredCoverLetter(true);
      }
      const emailStep = nextStatuses["email_drafter"];
      if (emailStep && emailStep.state !== "skipped") {
        setInferredEmail(true);
      }

      if (data.overall_status === "done") {
        onDoneRef.current();
        return;
      }
      if (data.overall_status === "failed") {
        // The doc's raw `error` may carry internal detail — keep it out of the UI.
        if (process.env.NODE_ENV !== "production" && data.error) {
          console.warn("[pipeline] failed:", data.error);
        }
        onFailedRef.current(PIPELINE_FAILED_MESSAGE);
        return;
      }
      if (
        data.overall_status === "awaiting_review" &&
        onAwaitingReviewRef.current
      ) {
        onAwaitingReviewRef.current();
        return;
      }

      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pipelineId]);

  // Tick the elapsed counter once a second until the pipeline reaches a
  // terminal state (the parent usually unmounts us before then anyway).
  useEffect(() => {
    if (overall === "done" || overall === "failed") return;
    const id = setInterval(
      () => setElapsed((e) => computeElapsed(anchorsRef.current, e)),
      1000,
    );
    return () => clearInterval(id);
  }, [overall]);

  // Look up the most recent finished application's processing time to set
  // expectations. Best-effort: silently no-ops if the list can't be fetched.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await listMyPipelines();
      if (cancelled || !data) return;
      const prev = data
        .filter(
          (p) =>
            p.pipeline_id !== pipelineId &&
            p.overall_status === "done" &&
            p.duration_seconds != null,
        )
        .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0];
      if (prev) setPrevDuration(prev.duration_seconds);
    })();
    return () => {
      cancelled = true;
    };
  }, [pipelineId]);

  const completedCount = Object.values(statuses).filter(
    (s) => s.state === "done" || s.state === "skipped",
  ).length;
  const visibleTotal = steps.length;
  const progressPct = Math.min(
    100,
    Math.round((completedCount / Math.max(1, visibleTotal)) * 100),
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Tailoring your application
          </h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">{progressPct}%</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 font-medium tabular-nums text-slate-600 dark:text-slate-300">
            <Clock className="h-3.5 w-3.5" />
            {formatClock(elapsed)}
          </span>
          {prevDuration != null && (
            <span className="text-slate-400 dark:text-slate-500">
              · your last application took {formatDuration(prevDuration)}
            </span>
          )}
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-fuchsia-500 bg-[length:200%_100%] animate-shimmer"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          />
        </div>
      </div>

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {steps.map((step, idx) => {
            const status = statuses[step.key];
            const state: StepState = status?.state ?? "pending";
            return (
              <motion.li
                key={step.key}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border bg-white/60 dark:bg-slate-900/50 px-4 py-3 transition-colors",
                  state === "running" && "border-violet-300 dark:border-violet-600/50 bg-violet-50 dark:bg-violet-500/10",
                  state === "done" && "border-emerald-200 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-500/10",
                  state === "failed" && "border-rose-300 dark:border-rose-700/40 bg-rose-50 dark:bg-rose-500/10",
                  state === "skipped" && "border-slate-200 dark:border-slate-700/60 opacity-60",
                  state === "pending" && "border-slate-200 dark:border-slate-700/60",
                )}
              >
                <StepIcon state={state} />
                <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {step.label}
                </span>
                {status?.message && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {status.message}
                  </span>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {overall === "failed" && (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          Something went wrong. Try again or check the logs.
        </p>
      )}
    </div>
  );
}

function StepIcon({ state }: { state: StepState }) {
  const base = "h-5 w-5";
  if (state === "done")
    return <CheckCircle2 className={cn(base, "text-emerald-500 dark:text-emerald-400")} />;
  if (state === "failed")
    return <XCircle className={cn(base, "text-rose-500 dark:text-rose-400")} />;
  if (state === "skipped")
    return <MinusCircle className={cn(base, "text-slate-400 dark:text-slate-500")} />;
  if (state === "running")
    return <Loader2 className={cn(base, "animate-spin text-violet-500 dark:text-violet-400")} />;
  return <Circle className={cn(base, "text-slate-300")} />;
}
