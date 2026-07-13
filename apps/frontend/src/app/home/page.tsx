"use client";

import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { AppNavBar } from "@/components/AppNavBar";
import { Hero } from "@/components/Hero";
import { JobInput, type JobInputValue } from "@/components/JobInput";
import { ResumeUpload } from "@/components/ResumeUpload";
import { SectionHeader } from "@/components/SectionHeader";
import { TemplatePickerModal } from "@/components/TemplatePickerModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CardSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { Logo } from "@/components/ui/Logo";
import { useRequireAuth } from "@/lib/require-auth";
import { newPipelineId } from "@/lib/uuid";
import { startPipeline } from "@/services/api";
import type { ResumeTemplate, ResumeUploadResponse } from "@applyai/types";

function defaultJobInput(): JobInputValue {
  return {
    url: "",
    raw_jd: "",
    mode: "url",
    want_cover_letter: false,
    company_name: "",
    role_title: "",
  };
}

function HomePageInner() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const search = useSearchParams();

  // Pre-fill JD URL from the landing page hand-off, if present.
  const initialJd = useMemo(() => {
    const jd = search?.get("jd")?.trim();
    return jd ? { url: jd, mode: "url" as const } : null;
  }, [search]);

  const [fileId, setFileId] = useState<string | null>(null);
  const [resumeMeta, setResumeMeta] =
    useState<ResumeUploadResponse | null>(null);
  const [jobInput, setJobInput] = useState<JobInputValue>(() => ({
    ...defaultJobInput(),
    ...(initialJd ?? {}),
  }));
  const [starting, setStarting] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the user lands here later with a fresh ?jd= param, honour it.
  useEffect(() => {
    if (!initialJd) return;
    setJobInput((prev) => ({ ...prev, ...initialJd }));
  }, [initialJd]);

  const canStart =
    !!fileId &&
    (jobInput.mode === "url"
      ? jobInput.url.trim().length > 0
      : jobInput.raw_jd.trim().length > 100);

  // "Tailor my application" opens the template chooser; the pipeline starts
  // only once the user confirms a style in the modal.
  const handleStart = async (templateId: ResumeTemplate) => {
    if (!fileId) return;
    setError(null);
    setStarting(true);
    const pipelineId = newPipelineId();
    const { data, error: err } = await startPipeline({
      pipeline_id: pipelineId,
      file_id: fileId,
      job_input: {
        url: jobInput.mode === "url" ? jobInput.url.trim() || null : null,
        raw_jd: jobInput.raw_jd.trim() || null,
        company_name: jobInput.company_name.trim() || null,
        role_title: jobInput.role_title.trim() || null,
      },
      want_cover_letter: jobInput.want_cover_letter,
      candidate_email_to_send: null,
      template_id: templateId,
    });
    if (err || !data) {
      setStarting(false);
      setTemplateOpen(false);
      setError(err ?? "Failed to start pipeline");
      return;
    }
    // Hand off to the progress route immediately — it polls /status and
    // swaps to the result view when the pipeline finishes.
    router.push(`/pipeline/${data.pipeline_id}`);
  };

  if (loading || !user) {
    return <HomeSkeleton />;
  }

  return (
    <main className="font-system min-h-screen px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between sm:mb-12">
          <Link href="/home" aria-label="ApplyAI home">
            <Logo variant="primary" priority className="h-12 w-auto sm:h-16" />
          </Link>
          <AppNavBar />
        </header>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-10"
        >
          <Hero />

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="space-y-4">
              <SectionHeader
                eyebrow="Step 1"
                title="Upload your resume"
                subtitle="PDF, DOCX, or TXT — parsed automatically."
              />
              <ResumeUpload
                fileId={fileId}
                onUploaded={(meta) => {
                  setFileId(meta.file_id);
                  setResumeMeta(meta);
                }}
                onReset={() => {
                  setFileId(null);
                  setResumeMeta(null);
                }}
              />
              {resumeMeta && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Parsed {resumeMeta.text_length.toLocaleString()} characters.
                </p>
              )}
            </Card>

            <Card className="space-y-4">
              <SectionHeader
                eyebrow="Step 2"
                title="Add the job"
                subtitle="Paste a URL or the JD itself."
              />
              <JobInput value={jobInput} onChange={setJobInput} />
            </Card>
          </div>

          <div className="flex flex-col items-center gap-3">
            {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
            <Button
              size="lg"
              disabled={!canStart || starting}
              onClick={() => setTemplateOpen(true)}
              className="w-full sm:w-auto bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 hover:from-violet-500 hover:via-indigo-500 hover:to-fuchsia-500 shadow-[0_8px_30px_-6px_rgba(139,92,246,0.5)]"
            >
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  Tailor my application
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            {!canStart && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add a resume and a job description to continue.
              </p>
            )}
          </div>
        </motion.section>
      </div>

      <TemplatePickerModal
        open={templateOpen}
        busy={starting}
        onConfirm={(template) => void handleStart(template)}
        onCancel={() => !starting && setTemplateOpen(false)}
      />
    </main>
  );
}

// Skeleton for the auth check + Suspense boundary: mirrors the real layout
// (logo/nav header, hero, the two step cards, and the CTA) so the page settles
// in place once auth resolves.
function HomeSkeleton() {
  return (
    <main className="font-system min-h-screen px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between sm:mb-12">
          <Skeleton className="h-16 w-36" />
          <Skeleton className="h-9 w-40 rounded-full" />
        </header>
        <div className="space-y-6 sm:space-y-10">
          <div className="mx-auto max-w-3xl space-y-3 text-center">
            <Skeleton className="mx-auto h-10 w-3/4" />
            <Skeleton className="mx-auto h-4 w-1/2" />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <CardSkeleton lines={3} />
            <CardSkeleton lines={3} />
          </div>
          <div className="flex justify-center">
            <Skeleton className="h-12 w-56 rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomePageInner />
    </Suspense>
  );
}
