"use client";

import { ArrowLeft, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ChangeReview } from "@/components/ChangeReview";
import { PipelineProgress } from "@/components/PipelineProgress";
import { PipelineResultTabs } from "@/components/PipelineResultTabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CardSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { Logo } from "@/components/ui/Logo";
import { useRequireAuth } from "@/lib/require-auth";
import {
  getPipelineResult,
  getPipelineStatus,
  PIPELINE_FAILED_MESSAGE,
} from "@/services/api";
import type { OverallStatus, PipelineResult } from "@applyai/types";

type View =
  | { kind: "loading" }
  | { kind: "progress" }
  | { kind: "review" }
  | { kind: "result"; result: PipelineResult }
  | { kind: "error"; message: string };

export default function PipelineDetailPage() {
  const { user, loading } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  // Both "Start Over" and "New Application" send the user back to /home to
  // begin a fresh application. The current pipeline keeps running in the
  // background and stays available under History.
  const startNew = useCallback(() => router.push("/home"), [router]);

  // Only surface "Back to history" when the user actually arrived from the
  // history list (we tag those links with ?from=history). A freshly started
  // pipeline shows a "New application" affordance near the tabs instead.
  const [fromHistory, setFromHistory] = useState(false);
  useEffect(() => {
    setFromHistory(
      new URLSearchParams(window.location.search).get("from") === "history",
    );
  }, []);

  const [view, setView] = useState<View>({ kind: "loading" });

  const loadResult = useCallback(async () => {
    if (!id) return;
    const { data, error } = await getPipelineResult(id);
    if (error || !data) {
      setView({ kind: "error", message: error ?? "Failed to load result" });
      return;
    }
    setView({ kind: "result", result: data });
  }, [id]);

  // On mount, decide whether to show progress or result.
  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await getPipelineStatus(id);
      if (cancelled) return;
      if (error || !data) {
        setView({ kind: "error", message: error ?? "Failed to load pipeline" });
        return;
      }
      const status: OverallStatus = data.overall_status;
      if (status === "done") {
        await loadResult();
      } else if (status === "failed") {
        setView({ kind: "error", message: PIPELINE_FAILED_MESSAGE });
      } else if (status === "awaiting_review") {
        setView({ kind: "review" });
      } else {
        setView({ kind: "progress" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, id, loadResult]);

  if (loading || !user) {
    return (
      <main className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="flex items-center justify-between">
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </header>
          <ResultSkeleton />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <Link href="/home" aria-label="ApplyAI home">
            <Logo variant="primary" priority className="h-12 w-auto sm:h-16" />
          </Link>
          <div className="flex items-center gap-3">
            {fromHistory && (
              <Link
                href="/history"
                className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to history
              </Link>
            )}
            <ThemeToggle />
          </div>
        </header>

        {view.kind === "loading" && <ResultSkeleton />}

        {view.kind === "error" && (
          <p className="text-sm text-rose-600 dark:text-rose-400">{view.message}</p>
        )}

        {view.kind === "progress" && id && (
          <div className="mx-auto max-w-2xl space-y-4">
            <Card>
              <PipelineProgress
                pipelineId={id}
                wantCoverLetter={false}
                wantEmail={false}
                onDone={() => void loadResult()}
                onFailed={(msg) =>
                  setView({
                    kind: "error",
                    message: msg ?? PIPELINE_FAILED_MESSAGE,
                  })
                }
                onAwaitingReview={() => setView({ kind: "review" })}
              />
            </Card>
            <div className="flex justify-center">
              <Button variant="ghost" onClick={startNew}>
                <RotateCcw className="h-4 w-4" />
                Start over
              </Button>
            </div>
          </div>
        )}

        {view.kind === "review" && id && (
          <div className="mx-auto max-w-2xl">
            <ChangeReview
              pipelineId={id}
              onApplied={() => setView({ kind: "progress" })}
            />
          </div>
        )}

        {view.kind === "result" && id && (
          <div className="space-y-8">
            <PipelineResultTabs
              result={view.result}
              onNewApplication={fromHistory ? undefined : startNew}
            />
            {fromHistory && (
              <div className="flex justify-center border-t border-slate-200 pt-8 dark:border-slate-700/60">
                <Button size="lg" onClick={startNew}>
                  <Plus className="h-4 w-4" />
                  New application
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// Placeholder shown while the pipeline status/result is being fetched. Mirrors
// the tabbed result layout — a centered tab strip over stacked content cards —
// so the page doesn't jump when the real result lands.
function ResultSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading result">
      <div className="flex justify-center">
        <Skeleton className="h-10 w-full max-w-xl rounded-full" />
      </div>
      <CardSkeleton lines={3} />
      <CardSkeleton lines={5} />
    </div>
  );
}
