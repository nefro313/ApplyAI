"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ClipboardPaste,
  Globe,
  Loader2,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { scrapeJd } from "@/services/api";

type Mode = "url" | "paste";

// Login-walled job boards the scraper can't read. Matched against the URL's
// hostname so deep links and country domains (indeed.co.in, …) are caught.
const BLOCKED_SITES: { match: RegExp; name: string }[] = [
  { match: /(^|\.)linkedin\.com$/i, name: "LinkedIn" },
  { match: /(^|\.)indeed\.[a-z.]+$/i, name: "Indeed" },
  { match: /(^|\.)glassdoor\.[a-z.]+$/i, name: "Glassdoor" },
  { match: /(^|\.)naukri\.com$/i, name: "Naukri" },
  { match: /(^|\.)monster\.[a-z.]+$/i, name: "Monster" },
  { match: /(^|\.)ziprecruiter\.com$/i, name: "ZipRecruiter" },
];

/** Name of the login-walled job board the URL points at, or null. */
function blockedSiteName(url: string): string | null {
  const candidate = url.trim();
  if (!candidate) return null;
  let host: string;
  try {
    host = new URL(
      candidate.includes("://") ? candidate : `https://${candidate}`,
    ).hostname;
  } catch {
    return null;
  }
  return BLOCKED_SITES.find((s) => s.match.test(host))?.name ?? null;
}

export type JobInputValue = {
  url: string;
  raw_jd: string;
  mode: Mode;
  want_cover_letter: boolean;
  company_name: string;
  role_title: string;
};

type Props = {
  value: JobInputValue;
  onChange: (value: JobInputValue) => void;
};

export function JobInput({ value, onChange }: Props) {
  const [fetching, setFetching] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const set = (patch: Partial<JobInputValue>) =>
    onChange({ ...value, ...patch });

  const blockedSite = blockedSiteName(value.url);

  const handleFetch = async () => {
    if (!value.url.trim()) return;
    setHint(null);
    setFetching(true);
    const { data, error } = await scrapeJd(value.url.trim());
    setFetching(false);
    if (error || !data?.success || !data.jd_text) {
      set({ mode: "paste" });
      setHint(
        data?.message ??
          "Couldn't fetch — please paste the JD below",
      );
      return;
    }
    set({ raw_jd: data.jd_text, mode: "paste" });
    setHint("Fetched! You can edit before continuing.");
  };

  return (
    <div className="space-y-4">
      <Tabs<Mode>
        value={value.mode}
        onValueChange={(mode) => set({ mode })}
        options={[
          { value: "url", label: "Job URL" },
          { value: "paste", label: "Paste JD" },
        ]}
        activeClassName="dark:bg-gradient-to-r dark:from-violet-600 dark:to-indigo-600 dark:text-white"
      />

      {value.mode === "url" ? (
        <motion.div
          key="url"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="relative">
            <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              type="url"
              placeholder="https://jobs.example.com/senior-ml-engineer"
              value={value.url}
              onChange={(e) => set({ url: e.target.value })}
              aria-invalid={!!blockedSite}
              className="glass-field pl-9"
            />
          </div>

          <AnimatePresence initial={false} mode="wait">
            {blockedSite ? (
              <motion.div
                key="blocked"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50/80 px-3.5 py-3 dark:border-amber-600/40 dark:bg-amber-500/10"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1.5 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                  <p>
                    <span className="font-semibold">
                      {blockedSite} links can&apos;t be fetched.
                    </span>{" "}
                    {blockedSite} blocks automated reading of its job pages.
                    Open the posting, copy the description, and paste it here
                    instead.
                  </p>
                  <button
                    type="button"
                    onClick={() => set({ mode: "paste" })}
                    className="inline-flex items-center gap-1.5 font-semibold text-amber-900 underline underline-offset-2 transition hover:text-amber-700 dark:text-amber-100 dark:hover:text-amber-300"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    Paste it instead
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.p
                key="tip"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="text-xs text-slate-400 dark:text-slate-500"
              >
                Works best with company career pages. Job boards like
                LinkedIn, Indeed, Glassdoor &amp; Naukri block fetching — use{" "}
                <button
                  type="button"
                  onClick={() => set({ mode: "paste" })}
                  className="font-medium text-slate-500 underline underline-offset-2 transition hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-300"
                >
                  Paste JD
                </button>{" "}
                for those.
              </motion.p>
            )}
          </AnimatePresence>

          <Button
            onClick={handleFetch}
            disabled={!value.url.trim() || fetching || !!blockedSite}
            className="w-full bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 hover:from-violet-500 hover:via-indigo-500 hover:to-fuchsia-500"
          >
            {fetching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching JD…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Fetch JD
              </>
            )}
          </Button>
        </motion.div>
      ) : (
        <motion.div
          key="paste"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Textarea
            rows={10}
            placeholder="Paste the full job description here…"
            value={value.raw_jd}
            onChange={(e) => set({ raw_jd: e.target.value })}
            className="glass-field resize-none"
          />
          <p className="mt-1 text-right text-xs text-slate-400 dark:text-slate-500">
            {value.raw_jd.length.toLocaleString()} chars
          </p>
        </motion.div>
      )}

      {hint && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-amber-700 dark:text-amber-300"
        >
          {hint}
        </motion.p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="company-name"
            className="text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Company name <span className="text-slate-400 dark:text-slate-500">(optional)</span>
          </label>
          <Input
            id="company-name"
            placeholder="Acme Inc."
            value={value.company_name}
            onChange={(e) => set({ company_name: e.target.value })}
            className="glass-field"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="role-title"
            className="text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Job role <span className="text-slate-400 dark:text-slate-500">(optional)</span>
          </label>
          <Input
            id="role-title"
            placeholder="Senior ML Engineer"
            value={value.role_title}
            onChange={(e) => set({ role_title: e.target.value })}
            className="glass-field"
          />
        </div>
      </div>
      <p className="-mt-1 text-xs text-slate-500 dark:text-slate-400">
        Used as a fallback if the job description doesn&apos;t state them clearly.
      </p>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/50 px-4 py-3">
        <div>
          <label
            htmlFor="cover-letter-toggle"
            className="text-sm font-medium text-slate-900 dark:text-slate-100"
          >
            Include cover letter
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adds a tailored cover letter PDF to the bundle.
          </p>
        </div>
        <Switch
          id="cover-letter-toggle"
          checked={value.want_cover_letter}
          onCheckedChange={(c) => set({ want_cover_letter: c })}
        />
      </div>
    </div>
  );
}
