"use client";

import {
  Briefcase,
  Download,
  ExternalLink,
  FileText,
  Maximize2,
  PenLine,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

type Props = {
  resumeUrl?: string | null;
  resumeFilename?: string | null;
  resumeFileType?: string | null;
  resumeText?: string | null;
  /** Optional direct download link for the resume (e.g. the generated PDF). */
  resumeDownloadUrl?: string | null;
  /** Optional cover-letter PDF; surfaced as a download chip when present. */
  coverLetterUrl?: string | null;
  jdText?: string | null;
  roleTitle?: string | null;
  companyName?: string | null;
};

export function SourcePreview({
  resumeUrl,
  resumeFilename,
  resumeFileType,
  resumeText,
  resumeDownloadUrl,
  coverLetterUrl,
  jdText,
  roleTitle,
  companyName,
}: Props) {
  const hasResume = !!(resumeUrl || resumeText);
  const hasCover = !!coverLetterUrl;
  const hasJd = !!jdText;

  // Left panel shows one document at a time — toggle between the tailored
  // resume and the cover letter (when present).
  const [doc, setDoc] = useState<"resume" | "cover">("resume");
  const showCover = doc === "cover" && hasCover;
  const downloadUrl = showCover
    ? coverLetterUrl
    : resumeDownloadUrl ?? resumeUrl;

  if (!hasResume && !hasCover && !hasJd) return null;

  return (
    <Card className="p-4 sm:p-5">
      {/* Mobile: one document at a time via a Resume / Cover / JD tab strip,
          shorter preview height, and a full-screen escape hatch. */}
      <div className="lg:hidden">
        <MobilePreview
          hasResume={hasResume}
          hasCover={hasCover}
          hasJd={hasJd}
          resumeUrl={resumeUrl}
          resumeFileType={resumeFileType}
          resumeText={resumeText}
          resumeDownloadUrl={resumeDownloadUrl}
          coverLetterUrl={coverLetterUrl}
          jdText={jdText}
          roleTitle={roleTitle}
          companyName={companyName}
        />
      </div>

      {/* Desktop: resume/cover + JD side-by-side. */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-2">
        {(hasResume || hasCover) && (
          <Panel
            accent
            tabs={
              hasCover ? (
                <div className="inline-flex rounded-lg bg-white/70 p-0.5 dark:bg-slate-800/60">
                  <DocTab
                    active={!showCover}
                    onClick={() => setDoc("resume")}
                    icon={<FileText className="h-3 w-3" />}
                    label="Resume"
                  />
                  <DocTab
                    active={showCover}
                    onClick={() => setDoc("cover")}
                    icon={<PenLine className="h-3 w-3" />}
                    label="Cover letter"
                  />
                </div>
              ) : (
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400" />
                  <span className="truncate font-semibold">
                    Your tailored resume
                  </span>
                  <span className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Tailored
                  </span>
                </span>
              )
            }
            action={
              downloadUrl ? (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-violet-600 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
                >
                  {showCover || resumeDownloadUrl ? (
                    <Download className="h-3 w-3" />
                  ) : (
                    <Maximize2 className="h-3 w-3" />
                  )}
                  {showCover || resumeDownloadUrl ? "Download" : "Open"}
                </a>
              ) : null
            }
          >
            {showCover ? (
              <ResumeBody url={coverLetterUrl} fileType="pdf" text={null} />
            ) : (
              <ResumeBody
                url={resumeUrl}
                fileType={resumeFileType}
                text={resumeText}
              />
            )}
          </Panel>
        )}

        {hasJd && (
          <Panel
            icon={<Briefcase className="h-3.5 w-3.5 text-slate-400" />}
            title={roleTitle ?? "Job description"}
            subtitle={companyName ?? undefined}
            action={
              <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {(jdText as string).length.toLocaleString()} chars
              </span>
            }
          >
            <pre className="h-[60svh] min-h-[360px] lg:h-[620px] overflow-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-[12px] leading-relaxed text-slate-700 dark:text-slate-200">
              {jdText}
            </pre>
          </Panel>
        )}
      </div>
    </Card>
  );
}

type MobileView = "resume" | "cover" | "jd";

function MobilePreview({
  hasResume,
  hasCover,
  hasJd,
  resumeUrl,
  resumeFileType,
  resumeText,
  resumeDownloadUrl,
  coverLetterUrl,
  jdText,
  roleTitle,
  companyName,
}: {
  hasResume: boolean;
  hasCover: boolean;
  hasJd: boolean;
  resumeUrl?: string | null;
  resumeFileType?: string | null;
  resumeText?: string | null;
  resumeDownloadUrl?: string | null;
  coverLetterUrl?: string | null;
  jdText?: string | null;
  roleTitle?: string | null;
  companyName?: string | null;
}) {
  const tabs: { key: MobileView; label: string; icon: React.ReactNode }[] = [];
  if (hasResume)
    tabs.push({ key: "resume", label: "Resume", icon: <FileText className="h-3 w-3" /> });
  if (hasCover)
    tabs.push({ key: "cover", label: "Cover letter", icon: <PenLine className="h-3 w-3" /> });
  if (hasJd)
    tabs.push({ key: "jd", label: "JD", icon: <Briefcase className="h-3 w-3" /> });

  const [view, setView] = useState<MobileView>(tabs[0]?.key ?? "resume");

  // Full-screen opens the underlying PDF in a new tab (JD is plain text).
  const fullscreenUrl =
    view === "resume"
      ? resumeDownloadUrl ?? resumeUrl
      : view === "cover"
        ? coverLetterUrl
        : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex max-w-full overflow-x-auto rounded-lg bg-white/70 p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:bg-slate-800/60">
          {tabs.map((t) => (
            <DocTab
              key={t.key}
              active={view === t.key}
              onClick={() => setView(t.key)}
              icon={t.icon}
              label={t.label}
            />
          ))}
        </div>
        {fullscreenUrl && (
          <a
            href={fullscreenUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ring-focus inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-300"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Full screen
          </a>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-violet-200/70 ring-1 ring-violet-500/10 dark:border-violet-500/25">
        {view === "resume" && (
          <ResumeBody
            url={resumeUrl}
            fileType={resumeFileType}
            text={resumeText}
            heightClass={PREVIEW_H_MOBILE}
          />
        )}
        {view === "cover" && (
          <ResumeBody
            url={coverLetterUrl}
            fileType="pdf"
            text={null}
            heightClass={PREVIEW_H_MOBILE}
          />
        )}
        {view === "jd" && (
          <div>
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-300">
              <Briefcase className="h-3.5 w-3.5 text-slate-400" />
              <span className="truncate font-semibold">
                {roleTitle ?? "Job description"}
              </span>
              {companyName && (
                <span className="truncate font-normal text-slate-400 dark:text-slate-500">
                  · {companyName}
                </span>
              )}
            </div>
            <pre
              className={cn(
                "overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-700 dark:text-slate-200",
                PREVIEW_H_MOBILE,
              )}
            >
              {jdText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function DocTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
        active
          ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm"
          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Panel({
  icon,
  title,
  subtitle,
  pill,
  accent,
  action,
  tabs,
  children,
}: {
  icon?: React.ReactNode;
  title?: string;
  subtitle?: string;
  pill?: string;
  accent?: boolean;
  action?: React.ReactNode;
  /** When provided, replaces the icon/title/pill header content (left side). */
  tabs?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-white dark:bg-slate-900/60",
        accent
          ? "border-violet-200/70 ring-1 ring-violet-500/10 dark:border-violet-500/25"
          : "border-slate-200 dark:border-slate-700/60",
      )}
    >
      {accent && (
        <div className="h-0.5 w-full bg-gradient-to-r from-violet-500 via-indigo-500 to-fuchsia-500" />
      )}
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b px-4 py-2.5 text-xs",
          accent
            ? "border-violet-100 bg-violet-50/50 text-slate-700 dark:border-violet-500/15 dark:bg-violet-500/5 dark:text-slate-200"
            : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-300",
        )}
      >
        {tabs ?? (
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate font-semibold">{title}</span>
          {subtitle && (
            <span className="truncate font-normal text-slate-400 dark:text-slate-500">
              · {subtitle}
            </span>
          )}
          {pill && (
            <span className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              {pill}
            </span>
          )}
        </span>
        )}
        {action && <span className="shrink-0 text-xs">{action}</span>}
      </div>
      {children}
    </div>
  );
}

// Default preview height: a viewport-relative clamp on tablet, full 620px on
// desktop. Mobile callers pass a fixed shorter height (PREVIEW_H_MOBILE).
const PREVIEW_H = "h-[60svh] min-h-[360px] lg:h-[620px]";
const PREVIEW_H_MOBILE = "h-[400px]";

function ResumeBody({
  url,
  fileType,
  text,
  heightClass = PREVIEW_H,
}: {
  url?: string | null;
  fileType?: string | null;
  text?: string | null;
  heightClass?: string;
}) {
  const isPdf = (fileType ?? "").toLowerCase() === "pdf";

  if (isPdf && url) {
    return <PdfPreview url={url} text={text} heightClass={heightClass} />;
  }
  return <FallbackText text={text} url={url} heightClass={heightClass} />;
}

// Embedded PDF with a shimmer placeholder over it until the document paints.
// `<object>` onLoad is unreliable across browsers, so a safety timeout clears
// the skeleton regardless after a few seconds.
function PdfPreview({
  url,
  text,
  heightClass = PREVIEW_H,
}: {
  url: string;
  text?: string | null;
  heightClass?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const t = setTimeout(() => setLoaded(true), 4000);
    return () => clearTimeout(t);
  }, [url]);

  return (
    <div className={cn("relative", heightClass)}>
      {!loaded && (
        <div
          aria-hidden
          className="absolute inset-0 z-10 space-y-3 bg-slate-100 px-6 py-6 dark:bg-slate-950"
        >
          <Skeleton className="mx-auto h-6 w-2/3" />
          <Skeleton className="mx-auto h-3 w-1/3" />
          <div className="space-y-2 pt-4">
            {[100, 96, 90, 98, 84, 92, 70].map((w, i) => (
              <Skeleton
                key={i}
                style={{ width: `${w}%` }}
                className="h-3"
              />
            ))}
          </div>
        </div>
      )}
      <object
        data={url}
        type="application/pdf"
        onLoad={() => setLoaded(true)}
        className={cn("w-full bg-slate-100 dark:bg-slate-950", heightClass)}
      >
        <FallbackText text={text} url={url} heightClass={heightClass} />
      </object>
    </div>
  );
}

function FallbackText({
  text,
  url,
  heightClass = PREVIEW_H,
}: {
  text?: string | null;
  url?: string | null;
  heightClass?: string;
}) {
  if (!text && !url) {
    return (
      <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No preview available.
      </p>
    );
  }
  if (!text && url) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 px-6 text-center",
          heightClass,
        )}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Inline preview unavailable for this format.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 dark:text-violet-300 hover:underline"
        >
          Open in new tab
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }
  return (
    <pre
      className={cn(
        "overflow-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-[12px] leading-relaxed text-slate-700 dark:text-slate-200",
        heightClass,
      )}
    >
      {text}
    </pre>
  );
}
