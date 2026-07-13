"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import { applyChanges, getPipelineReview } from "@/services/api";
import type { ChangeCategory, ProposedChange } from "@applyai/types";

type Props = {
  pipelineId: string;
  /** Called once the user applies their selection and generation kicks off. */
  onApplied: () => void;
};

const CATEGORY_LABEL: Record<ChangeCategory, string> = {
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  keywords: "Keywords",
};

const CUSTOM_ID = "custom";

/** Per-change selection state, keyed by change id. */
type Selection = {
  accepted: boolean;
  optionId: string | null;
  customText: string;
  /** Selected skill chips (skills-category changes only). */
  chips: string[];
};

function initialSelection(c: ProposedChange): Selection {
  const firstAi = c.options.find((o) => o.kind === "ai");
  return {
    accepted: c.accepted,
    optionId: c.selected_option_id ?? firstAi?.id ?? c.options[0]?.id ?? null,
    customText: c.custom_text ?? "",
    chips: c.selected_chips ?? c.chips ?? [],
  };
}

/** Whether a change, given its selection, actually edits the resume. */
function isEditing(c: ProposedChange, s: Selection | undefined): boolean {
  if (!s) return false;
  if (c.category === "skills" && c.chips.length > 0) return s.chips.length > 0;
  if (c.options.length === 0) return s.accepted;
  return s.accepted && s.optionId !== "original";
}

export function ChangeReview({ pipelineId, onApplied }: Props) {
  const [changes, setChanges] = useState<ProposedChange[] | null>(null);
  const [sel, setSel] = useState<Record<string, Selection>>({});
  const [notes, setNotes] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Wizard cursor. The final step (index === changes.length) is the summary.
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await getPipelineReview(pipelineId);
      if (cancelled) return;
      if (error || !data) {
        setLoadError(error ?? "Could not load proposed changes");
        return;
      }
      setChanges(data.proposed_changes);
      setRole(data.role_title);
      setCompany(data.company_name);
      setSel(
        Object.fromEntries(
          data.proposed_changes.map((c) => [c.id, initialSelection(c)]),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [pipelineId]);

  const update = (id: string, patch: Partial<Selection>) =>
    setSel((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const editCount = useMemo(() => {
    if (!changes) return 0;
    return changes.filter((c) => isEditing(c, sel[c.id])).length;
  }, [changes, sel]);

  const total = changes?.length ?? 0;
  const isSummary = step >= total;
  const current = !isSummary && changes ? changes[step] : null;
  const currentSel = current ? sel[current.id] : undefined;

  // Block leaving a change step while its "Write my own" box is empty.
  const blockedByCustom =
    !!current &&
    currentSel?.optionId === CUSTOM_ID &&
    currentSel.customText.trim().length === 0;

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(Math.max(0, Math.min(total, next)));
  };

  const submit = async () => {
    if (!changes) return;
    setSubmitting(true);
    setSubmitError(null);
    const selections = changes.map((c) => {
      const s = sel[c.id];
      if (c.category === "skills" && c.chips.length > 0) {
        return { id: c.id, accepted: true, selected_chips: s?.chips ?? [] };
      }
      if (c.options.length === 0) {
        return { id: c.id, accepted: !!s?.accepted };
      }
      return {
        id: c.id,
        accepted: !!s?.accepted,
        option_id: s?.optionId ?? null,
        custom_text: s?.optionId === CUSTOM_ID ? s.customText.trim() : null,
      };
    });
    const { error } = await applyChanges(pipelineId, {
      selections,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error);
      return;
    }
    onApplied();
  };

  if (loadError) {
    return (
      <Card>
        <p className="text-sm text-rose-600 dark:text-rose-400">{loadError}</p>
      </Card>
    );
  }

  if (!changes) {
    return (
      <Card className="space-y-6" role="status" aria-label="Loading proposed changes">
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <SkeletonText lines={2} />
        </div>
        {/* stepper bar */}
        <div className="flex gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-1.5 flex-1 rounded-full" />
          ))}
        </div>
        {/* current-step body */}
        <div className="min-h-[14rem] space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700/60">
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-6">
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <ListChecks className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            Review proposed changes
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            We&apos;ll tailor your resume{role ? ` for ${role}` : ""}
            {company ? ` at ${company}` : ""}. Step through each change and pick
            the version you like best. Nothing here invents skills you
            don&apos;t have.
          </p>
        </div>

        {/* Stepper */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>
              {isSummary
                ? "Final step"
                : `Change ${step + 1} of ${total}`}
            </span>
            <span>
              {editCount} {editCount === 1 ? "edit" : "edits"} selected
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: total + 1 }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to step ${i + 1}`}
                onClick={() => go(i)}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i < step
                    ? "bg-violet-400 dark:bg-violet-500"
                    : i === step
                      ? "bg-violet-600 dark:bg-violet-400"
                      : "bg-slate-200 dark:bg-slate-700/70",
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="relative min-h-[14rem]">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {current ? (
              <ChangeStep
                change={current}
                sel={currentSel}
                onUpdate={(patch) => update(current.id, patch)}
              />
            ) : (
              <SummaryStep
                changes={changes}
                sel={sel}
                notes={notes}
                onNotes={setNotes}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {blockedByCustom && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Add your wording above before continuing.
        </p>
      )}
      {submitError && (
        <p className="text-sm text-rose-600 dark:text-rose-400">{submitError}</p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700/60">
        <Button
          variant="ghost"
          onClick={() => go(step - 1)}
          disabled={step === 0 || submitting}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        {isSummary ? (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Tailoring…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Apply &amp; generate
              </>
            )}
          </Button>
        ) : (
          <Button onClick={() => go(step + 1)} disabled={blockedByCustom}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* One change step                                                     */
/* ------------------------------------------------------------------ */

function ChangeStep({
  change,
  sel,
  onUpdate,
}: {
  change: ProposedChange;
  sel: Selection | undefined;
  onUpdate: (patch: Partial<Selection>) => void;
}) {
  const isSkills = change.category === "skills" && change.chips.length > 0;
  const hasOptions = change.options.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{CATEGORY_LABEL[change.category]}</Badge>
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {change.title}
        </span>
      </div>
      {change.detail && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {change.detail}
        </p>
      )}

      {isSkills ? (
        <SkillChips
          chips={change.chips}
          selected={sel?.chips ?? []}
          onToggle={(skill) => {
            const cur = sel?.chips ?? [];
            const next = cur.includes(skill)
              ? cur.filter((s) => s !== skill)
              : [...cur, skill];
            onUpdate({ chips: next });
          }}
          onAll={(on) => onUpdate({ chips: on ? [...change.chips] : [] })}
        />
      ) : hasOptions ? (
        <div className="space-y-2">
          {change.options.map((opt) => {
            const on = sel?.optionId === opt.id;
            const isCustom = opt.id === CUSTOM_ID;
            return (
              <div key={opt.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onUpdate({ optionId: opt.id, accepted: true })}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ring-focus",
                    on
                      ? "border-violet-300 dark:border-violet-600/50 bg-violet-50/70 dark:bg-violet-500/10"
                      : "border-slate-200 dark:border-slate-700/60 hover:border-violet-200 dark:hover:border-violet-700/40 hover:bg-slate-50/80 dark:hover:bg-slate-800/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                      on
                        ? "border-violet-500 bg-violet-500"
                        : "border-slate-300 dark:border-slate-600",
                    )}
                  >
                    {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isCustom && <Pencil className="h-3 w-3" />}
                      {opt.label}
                      {opt.kind === "original" && (
                        <span className="font-normal text-slate-400 dark:text-slate-500">
                          (no change)
                        </span>
                      )}
                    </span>
                    {!isCustom && opt.text && (
                      <span
                        className={cn(
                          "block text-sm",
                          opt.kind === "original"
                            ? "text-slate-500 dark:text-slate-400"
                            : "text-slate-700 dark:text-slate-200",
                        )}
                      >
                        {opt.text}
                      </span>
                    )}
                  </span>
                </button>
                {isCustom && on && (
                  <Textarea
                    rows={3}
                    autoFocus
                    value={sel?.customText ?? ""}
                    onChange={(e) => onUpdate({ customText: e.target.value })}
                    placeholder="Type the exact wording you'd like here…"
                    className="mt-2"
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          aria-pressed={!!sel?.accepted}
          onClick={() => onUpdate({ accepted: !sel?.accepted })}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ring-focus",
            sel?.accepted
              ? "border-violet-300 dark:border-violet-600/50 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300"
              : "border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400",
          )}
        >
          <Check className="h-3.5 w-3.5" />
          {sel?.accepted ? "Will apply" : "Apply this change"}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Clickable skill chips                                               */
/* ------------------------------------------------------------------ */

function SkillChips({
  chips,
  selected,
  onToggle,
  onAll,
}: {
  chips: string[];
  selected: string[];
  onToggle: (skill: string) => void;
  onAll: (on: boolean) => void;
}) {
  const allOn = selected.length === chips.length;
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Tap the skills you want surfaced in your resume. We only suggest skills
        your resume already backs up.
      </p>
      <div className="flex flex-wrap gap-2">
        {chips.map((skill) => {
          const on = selected.includes(skill);
          return (
            <button
              key={skill}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(skill)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ring-focus",
                on
                  ? "border-violet-400 bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-[0_1px_4px_rgba(99,102,241,0.35)]"
                  : "border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 hover:border-violet-300 dark:hover:border-violet-600/50",
              )}
            >
              {on ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {skill}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => onAll(!allOn)}
          className="font-medium text-violet-600 dark:text-violet-400 hover:underline ring-focus"
        >
          {allOn ? "Clear all" : "Select all"}
        </button>
        <span className="text-slate-400 dark:text-slate-500">
          {selected.length} of {chips.length} selected
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Final summary step                                                  */
/* ------------------------------------------------------------------ */

function SummaryStep({
  changes,
  sel,
  notes,
  onNotes,
}: {
  changes: ProposedChange[];
  sel: Record<string, Selection>;
  notes: string;
  onNotes: (v: string) => void;
}) {
  const editing = changes.filter((c) => isEditing(c, sel[c.id]));
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Sparkles className="h-4 w-4 text-violet-500 dark:text-violet-400" />
          Ready to tailor
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {editing.length > 0
            ? `Applying ${editing.length} ${editing.length === 1 ? "edit" : "edits"} — everything else stays in your own words.`
            : "No edits selected — your resume will be reformatted but kept as-is."}
        </p>
      </div>

      {editing.length > 0 && (
        <ul className="space-y-1.5">
          {editing.map((c) => (
            <li
              key={c.id}
              className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
            >
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {CATEGORY_LABEL[c.category]}:
                </span>{" "}
                {c.title}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Anything else you&apos;d like emphasised? (optional)
        </label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          placeholder="e.g. Lead with my RAG work, keep the resume to one page."
        />
      </div>
    </div>
  );
}
