"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { ApplyTab } from "@/components/ApplyTab";
import { AtsComparison } from "@/components/AtsComparison";
import { InterviewPrep } from "@/components/InterviewPrep";
import { RecruiterReview } from "@/components/RecruiterReview";
import { ResultView } from "@/components/ResultView";
import { ResumeRisks } from "@/components/ResumeRisks";
import { SkillRoadmap } from "@/components/SkillRoadmap";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import type { PipelineResult } from "@applyai/types";

type TabKey = "overview" | "resume" | "growth" | "interview" | "apply";

const TAB_OPTIONS: { value: TabKey; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "resume", label: "Resume" },
  { value: "growth", label: "Skills & Growth" },
  { value: "interview", label: "Interview" },
  { value: "apply", label: "Apply" },
];

type Props = {
  result: PipelineResult;
  // Provided for freshly generated results (not opened from history) so the
  // user can jump straight into a new application from the results header.
  onNewApplication?: () => void;
};

export function PipelineResultTabs({
  result: initial,
  onNewApplication,
}: Props) {
  const [result, setResult] = useState<PipelineResult>(initial);
  const [tab, setTab] = useState<TabKey>("overview");
  const pipelineId = result.pipeline_id;

  return (
    <div className="space-y-6">
      {/* Sticky on mobile so the tabs stay reachable while scrolling long
          result sections; reverts to a normal centered row from sm+. */}
      <div className="sticky top-0 z-20 -mx-4 bg-slate-50/85 px-4 py-2 backdrop-blur dark:bg-slate-950/85 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none sm:dark:bg-transparent">
        <div className="relative flex justify-center">
          <Tabs<TabKey> value={tab} onValueChange={setTab} options={TAB_OPTIONS} />
          {onNewApplication && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNewApplication}
              className="absolute right-0 top-1/2 hidden -translate-y-1/2 rounded-full lg:inline-flex"
            >
              <Plus className="h-4 w-4" />
              New application
            </Button>
          )}
        </div>
      </div>
      {onNewApplication && (
        <div className="flex justify-center lg:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={onNewApplication}
            className="rounded-full"
          >
            <Plus className="h-4 w-4" />
            New application
          </Button>
        </div>
      )}

      {tab === "overview" && (
        <div className="space-y-6">
          <ResultView result={result} onOpenApplyTab={() => setTab("apply")} />
          <RecruiterReview
            pipelineId={pipelineId}
            initial={result.recruiter_review}
            onGenerated={(recruiter_review) =>
              setResult((cur) => ({ ...cur, recruiter_review }))
            }
          />
        </div>
      )}

      {tab === "resume" && (
        <div className="space-y-6">
          <AtsComparison
            original={result.original_ats}
            tailored={result.tailored_ats}
          />
          <ResumeRisks
            pipelineId={pipelineId}
            initial={result.resume_risks}
            onGenerated={(resume_risks) =>
              setResult((cur) => ({ ...cur, resume_risks }))
            }
          />
        </div>
      )}

      {tab === "growth" && (
        <SkillRoadmap pipelineId={pipelineId} initial={result.skill_roadmap} />
      )}

      {tab === "interview" && (
        <InterviewPrep pipelineId={pipelineId} initial={result.interview_prep} />
      )}

      {tab === "apply" && <ApplyTab result={result} />}
    </div>
  );
}
