"use client";

import { GraduationCap, Map, Target } from "lucide-react";
import { useEffect, useState } from "react";

import { Accordion } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingPanel } from "@/components/ui/LoadingPanel";
import { getSkillRoadmap } from "@/services/api";
import type { SkillImportance, SkillRoadmap as Roadmap } from "@applyai/types";

type Props = { pipelineId: string; initial?: Roadmap | null };

const IMPORTANCE_TONE: Record<SkillImportance, "missing" | "warning" | "info"> = {
  critical: "warning",
  important: "info",
  nice_to_have: "missing",
};

const IMPORTANCE_LABEL: Record<SkillImportance, string> = {
  critical: "Critical",
  important: "Important",
  nice_to_have: "Nice to have",
};

export function SkillRoadmap({ pipelineId, initial }: Props) {
  const [data, setData] = useState<Roadmap | null>(initial ?? null);
  // The pipeline pre-computes this and ships it on the result, so we render
  // instantly when `initial` is present and only fetch as a fallback.
  const [busy, setBusy] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    const { data: res, error: err } = await getSkillRoadmap(pipelineId);
    setBusy(false);
    if (err || !res) setError(err ?? "Could not build a roadmap");
    else setData(res);
  };

  useEffect(() => {
    if (!initial) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId]);

  if (!data) {
    if (busy) {
      return (
        <LoadingPanel
          title="Mapping your skill gaps"
          subtitle="Comparing your experience against the role and drafting a learning plan."
        />
      );
    }
    return (
      <Card className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <GraduationCap className="h-4 w-4 text-violet-500 dark:text-violet-400" />
          Skill gap &amp; learning roadmap
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
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Target className="h-4 w-4 text-violet-500 dark:text-violet-400" />
          Skill gaps
        </div>
        {data.summary && (
          <p className="text-sm text-slate-600 dark:text-slate-400">{data.summary}</p>
        )}
        {data.gaps.length === 0 ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            No meaningful gaps — you&apos;re well matched for this role.
          </p>
        ) : (
          <Accordion
            items={data.gaps.map((g) => ({
              id: g.skill,
              title: g.skill,
              trailing: (
                <Badge tone={IMPORTANCE_TONE[g.importance]} className="shrink-0">
                  {IMPORTANCE_LABEL[g.importance]}
                </Badge>
              ),
              content: g.why ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">{g.why}</p>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  No additional detail.
                </p>
              ),
            }))}
          />
        )}
      </Card>

      {data.roadmap.length > 0 && (
        <Card className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Map className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            Learning roadmap
          </div>
          <Accordion
            defaultOpenId={`week-${data.roadmap[0].week}`}
            items={data.roadmap.map((w) => ({
              id: `week-${w.week}`,
              title: (
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                    W{w.week}
                  </span>
                  {w.focus}
                </span>
              ),
              content: (
                <div className="space-y-1">
                  {w.resources.length > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {w.resources.join(" · ")}
                    </p>
                  )}
                  {w.project && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Project: {w.project}
                    </p>
                  )}
                  {w.resources.length === 0 && !w.project && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Focus on {w.focus.toLowerCase()}.
                    </p>
                  )}
                </div>
              ),
            }))}
          />
        </Card>
      )}
    </div>
  );
}
