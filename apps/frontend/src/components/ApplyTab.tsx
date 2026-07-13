"use client";

import { motion, type Variants } from "framer-motion";
import {
  CheckCircle2,
  FileText,
  Mail,
  PenLine,
  Send,
  Sparkles,
} from "lucide-react";

import { DownloadMenu } from "@/components/DownloadMenu";
import { EmailCompose } from "@/components/EmailCompose";
import { SourcePreview } from "@/components/SourcePreview";
import { cn } from "@/lib/utils";
import type { PipelineResult } from "@applyai/types";

type Props = { result: PipelineResult };

export function ApplyTab({ result }: Props) {
  const score = result.tailored_ats?.score ?? result.ats_score.final_score;
  const firstName = (result.candidate_name || "You").split(" ")[0];

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.08 } },
      }}
      className="space-y-6"
    >
      {/* ── Hero ─────────────────────────────────────────────── */}
      <motion.div
        variants={fade}
        className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-violet-400/30 to-indigo-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-gradient-to-tr from-fuchsia-400/20 to-violet-400/5 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/70 bg-violet-50/80 px-3 py-1 text-xs font-semibold text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              Ready to apply
            </span>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
              {firstName}, your application is ready to send
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {result.role_title}
              </span>{" "}
              at{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {result.company_name}
              </span>{" "}
              — give it a final read, then send it in two clicks.
            </p>
          </div>

          <ScoreOrb score={score} />
        </div>

        <div className="relative mt-6 flex flex-wrap gap-2">
          <ReadyChip ok icon={<FileText className="h-3.5 w-3.5" />} label="Tailored resume" />
          <ReadyChip
            ok={!!result.cover_letter_pdf_url}
            icon={<PenLine className="h-3.5 w-3.5" />}
            label="Cover letter"
            mutedLabel="No cover letter"
          />
          <ReadyChip
            icon={<Mail className="h-3.5 w-3.5" />}
            label="Recruiter email"
            pending
            pendingLabel="Draft below"
          />
        </div>

        {/* Quick actions — full-width, touch-sized buttons on mobile. */}
        <div className="relative mt-5 grid gap-2 sm:grid-cols-2">
          <a
            href={result.resume_pdf_url}
            download="resume.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-[0_4px_14px_-2px_rgba(99,102,241,0.45)] transition hover:from-violet-500 hover:to-indigo-500"
          >
            <FileText className="h-4 w-4" />
            Download resume
          </a>
          {result.cover_letter_pdf_url && (
            <DownloadMenu
              label="Download cover letter"
              className="flex"
              buttonClassName="h-12 font-semibold"
              formats={[
                {
                  key: "cover_pdf",
                  label: "PDF",
                  description: "Best for online applications",
                  url: result.cover_letter_pdf_url,
                  filename: "cover_letter.pdf",
                  icon: <PenLine className="h-3.5 w-3.5" />,
                },
                {
                  key: "cover_docx",
                  label: "Word (DOCX)",
                  description: "Edit-ready Microsoft Word format",
                  url: result.cover_letter_docx_url ?? "",
                  filename: "cover_letter.docx",
                  icon: <FileText className="h-3.5 w-3.5" />,
                },
              ]}
            />
          )}
        </div>
      </motion.div>

      {/* ── Step 1 · Send ────────────────────────────────────── */}
      <motion.section variants={fade} className="space-y-3">
        <StepHeader
          n={1}
          icon={<Send className="h-4 w-4" />}
          title="Send to a recruiter"
          subtitle="We draft a tailored intro email and open it in Gmail."
        />
        <EmailCompose pipelineId={result.pipeline_id} />
      </motion.section>

      {/* ── Step 2 · Review ──────────────────────────────────── */}
      <motion.section variants={fade} className="space-y-3">
        <StepHeader
          n={2}
          icon={<FileText className="h-4 w-4" />}
          title="Review what you're sending"
          subtitle="Flip between your tailored resume and cover letter, side-by-side with the job description."
        />
        <SourcePreview
          resumeUrl={result.resume_pdf_url}
          resumeFilename={`${result.candidate_name || "tailored-resume"}.pdf`}
          resumeFileType="pdf"
          resumeText={result.resume_text}
          resumeDownloadUrl={result.resume_pdf_url}
          coverLetterUrl={result.cover_letter_pdf_url}
          jdText={result.jd_text}
          roleTitle={result.role_title}
          companyName={result.company_name}
        />
      </motion.section>
    </motion.div>
  );
}

const fade: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

function ScoreOrb({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "from-emerald-500 to-teal-500"
      : score >= 60
        ? "from-violet-500 to-indigo-500"
        : "from-amber-500 to-orange-500";
  return (
    <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
      <div
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg",
          tone,
        )}
      >
        <div className="text-center leading-none">
          <div className="text-2xl font-bold">{score}</div>
          <div className="text-[9px] uppercase tracking-wider opacity-90">match</div>
        </div>
      </div>
    </div>
  );
}

function ReadyChip({
  ok,
  pending,
  icon,
  label,
  mutedLabel,
  pendingLabel,
}: {
  ok?: boolean;
  pending?: boolean;
  icon: React.ReactNode;
  label: string;
  mutedLabel?: string;
  pendingLabel?: string;
}) {
  if (pending) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/60 px-3 py-1.5 text-xs font-medium text-slate-500 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-400">
        {icon}
        {label}
        <span className="text-slate-400 dark:text-slate-500">· {pendingLabel}</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
        ok
          ? "border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-slate-200 bg-white/60 text-slate-400 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-500",
      )}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : icon}
      {ok ? label : mutedLabel ?? label}
    </span>
  );
}

function StepHeader({
  n,
  icon,
  title,
  subtitle,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-[0_4px_14px_-2px_rgba(99,102,241,0.45)]">
        {icon}
        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-violet-600 shadow dark:bg-slate-900 dark:text-violet-400">
          {n}
        </span>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}
