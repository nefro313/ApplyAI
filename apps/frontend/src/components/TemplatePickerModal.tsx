"use client";

import { motion } from "framer-motion";
import { ArrowRight, Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import { TemplatePicker } from "@/components/TemplatePicker";
import { Button } from "@/components/ui/Button";
import type { ResumeTemplate } from "@applyai/types";

type Props = {
  open: boolean;
  /** Template highlighted when the modal opens. */
  initial?: ResumeTemplate;
  busy?: boolean;
  /** User confirmed — hands back the chosen template to start the pipeline. */
  onConfirm: (template: ResumeTemplate) => void;
  onCancel: () => void;
};

/**
 * Pops up after "Tailor my application" so the user picks a resume style
 * before the pipeline starts. Keeps its own draft selection so cancelling
 * doesn't mutate the page until the user commits.
 */
export function TemplatePickerModal({
  open,
  initial = "classic",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState<ResumeTemplate>(initial);

  // Reset the draft each time the modal re-opens.
  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => !busy && onCancel()}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Choose your resume style"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="glass relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-xl space-y-4 overflow-y-auto rounded-3xl p-4 sm:space-y-5 sm:p-6"
      >
        <button
          type="button"
          onClick={() => !busy && onCancel()}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800/60 dark:hover:text-slate-300 ring-focus"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 dark:border-violet-700/50 dark:bg-violet-500/10 dark:text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            One last step
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Choose your resume style
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your tailored resume will be rendered in this template. You can
            regenerate in another style later.
          </p>
        </div>

        <TemplatePicker value={draft} onChange={setDraft} />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(draft)} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting…
              </>
            ) : (
              <>
                Start tailoring
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
