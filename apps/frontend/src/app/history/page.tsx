"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  CheckSquare,
  Plus,
  Sparkles,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HistorySkeleton } from "@/components/HistorySkeleton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";
import { useRequireAuth } from "@/lib/require-auth";
import { cn, formatDuration } from "@/lib/utils";
import { deletePipeline, listMyPipelines } from "@/services/api";
import type { PipelineSummary } from "@applyai/types";

type Confirm = { kind: "selected" } | null;

function HistoryPageInner() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const [items, setItems] = useState<PipelineSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await listMyPipelines();
      if (cancelled) return;
      if (err || !data) setError(err ?? "Failed to load history");
      else setItems(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggleOne = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = useMemo(
    () => !!items && items.length > 0 && selected.size === items.length,
    [items, selected],
  );

  const toggleAll = () => {
    if (!items) return;
    setSelected(allSelected ? new Set() : new Set(items.map((p) => p.pipeline_id)));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    setDeleting(true);
    setError(null);

    const ids = [...selected];
    const results = await Promise.all(ids.map((id) => deletePipeline(id)));
    const failed = ids.filter((_, i) => results[i].error);
    const removed = new Set(ids.filter((_, i) => !results[i].error));
    setItems((cur) => (cur ?? []).filter((p) => !removed.has(p.pipeline_id)));
    setSelected(new Set(failed));
    if (failed.length) {
      setError(
        `Couldn't delete ${failed.length} application${failed.length > 1 ? "s" : ""}.`,
      );
      setDeleting(false);
      return;
    }
    setSelectMode(false);
    setDeleting(false);
    setConfirm(null);
  };

  if (loading || !user) {
    return (
      <main className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 h-5 w-40 animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-700/50" />
          <HistorySkeleton />
        </div>
      </main>
    );
  }

  const selectionCount = selected.size;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center justify-between sm:mb-8">
          <Link href="/home" aria-label="ApplyAI home">
            <Logo variant="primary" priority className="h-12 w-auto sm:h-16" />
          </Link>
          <Link
            href="/home"
            className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
            New application
          </Link>
        </header>

        {/* Toolbar: title + Select / Delete all, swaps to selection controls in select mode */}
        <div className="mb-4 flex min-h-9 items-center justify-between gap-3">
          <AnimatePresence mode="wait" initial={false}>
            {selectMode ? (
              <motion.div
                key="selection"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex w-full items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {selectionCount > 0 ? `${selectionCount} selected` : "Select items"}
                  </span>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs font-medium text-violet-600 transition hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={exitSelectMode}>
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={selectionCount === 0}
                    onClick={() => setConfirm({ kind: "selected" })}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete{selectionCount > 0 ? ` (${selectionCount})` : ""}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="title"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex w-full items-center justify-between gap-3"
              >
                <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Your applications
                </h1>
                {items && items.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectMode(true)}
                  >
                    <CheckSquare className="h-4 w-4" />
                    Select
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && <p className="mb-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        {items === null || deleting ? (
          <HistorySkeleton rows={items && items.length ? items.length : 4} />
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3">
            {items.map((p, i) => {
              const isSelected = selected.has(p.pipeline_id);
              return (
                <motion.li
                  key={p.pipeline_id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card
                    className={cn(
                      "flex items-center gap-3 transition hover:border-violet-300 dark:hover:border-violet-600/50 hover:shadow-md sm:gap-4",
                      isSelected &&
                        "border-violet-400 ring-1 ring-violet-400/40 dark:border-violet-500/60",
                    )}
                  >
                    {selectMode && (
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleOne(p.pipeline_id)}
                        label={`Select ${p.role_title ?? "application"}`}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        selectMode
                          ? toggleOne(p.pipeline_id)
                          : router.push(`/pipeline/${p.pipeline_id}?from=history`)
                      }
                      className="ring-focus flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left sm:gap-4"
                    >
                      <CompanyAvatar company={p.company_name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                          {p.role_title ?? "Untitled role"}
                        </p>
                        <MetaRow
                          company={p.company_name}
                          timestamp={p.updated_at ?? p.started_at}
                          durationSeconds={p.duration_seconds}
                        />
                      </div>
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                      {p.final_score !== null && (
                        <Badge tone="matched">{p.final_score}/100</Badge>
                      )}
                      <StatusBadge status={p.overall_status} />
                    </div>
                  </Card>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={`Delete ${selectionCount} application${selectionCount > 1 ? "s" : ""}?`}
        description="This permanently removes the selected applications and their generated files. This can't be undone."
        confirmLabel={`Delete ${selectionCount}`}
        busy={deleting}
        onConfirm={handleConfirm}
        onCancel={() => {
          if (!deleting) setConfirm(null);
        }}
      />
    </main>
  );
}

/** Custom animated checkbox matched to the app's violet accent. */
function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "ring-focus flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
        checked
          ? "border-violet-600 bg-violet-600 text-white dark:border-violet-500 dark:bg-violet-500"
          : "border-slate-300 bg-white hover:border-violet-400 dark:border-slate-600 dark:bg-slate-900/60 dark:hover:border-violet-500",
      )}
    >
      <AnimatePresence initial={false}>
        {checked && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/** Gradient avatar showing the company's initial — a quick visual anchor per row. */
function CompanyAvatar({ company }: { company: string | null }) {
  const initial = (company ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-indigo-500/15 text-base font-semibold text-violet-600 dark:text-violet-300 sm:flex">
      {initial}
    </div>
  );
}

/** Company • date • time • processing-duration meta line under the role title. */
function MetaRow({
  company,
  timestamp,
  durationSeconds,
}: {
  company: string | null;
  timestamp: string | null;
  durationSeconds: number | null;
}) {
  const d = timestamp ? new Date(timestamp) : null;
  const valid = d && !Number.isNaN(d.getTime());
  const dateStr = valid
    ? d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  const timeStr = valid
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;
  const durationStr = formatDuration(durationSeconds);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
      <span className="inline-flex min-w-0 items-center gap-1">
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{company ?? "Unknown company"}</span>
      </span>
      {dateStr && (
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          {dateStr}
          {timeStr && <span className="text-slate-400 dark:text-slate-500">· {timeStr}</span>}
        </span>
      )}
      {durationStr && (
        <span
          className="inline-flex items-center gap-1"
          title="Time spent tailoring this application"
        >
          <Timer className="h-3.5 w-3.5 shrink-0" />
          {durationStr}
        </span>
      )}
    </div>
  );
}

/** Status pill with a tone matched to the pipeline's lifecycle state. */
function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "done"
      ? "matched"
      : status === "failed"
        ? "missing"
        : status === "awaiting_review"
          ? "warning"
          : "info";
  const label = status === "awaiting_review" ? "needs review" : status;
  return <Badge tone={tone}>{label}</Badge>;
}

/** Friendly empty state that funnels users to start their first application. */
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="flex flex-col items-center gap-5 px-6 py-12 text-center sm:py-16">
        <div className="relative">
          <div className="absolute inset-0 -z-10 animate-pulse rounded-full bg-violet-400/20 blur-2xl" />
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 text-violet-600 dark:from-violet-500/20 dark:to-indigo-500/20 dark:text-violet-400">
            <Sparkles className="h-7 w-7" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            No applications yet
          </h2>
          <p className="mx-auto max-w-sm text-sm text-slate-500 dark:text-slate-400">
            Tailor your resume to a job in about a minute. Your applications will
            show up here once you start.
          </p>
        </div>
        <Link href="/home">
          <Button size="md">
            <Plus className="h-4 w-4" />
            New application
          </Button>
        </Link>
      </Card>
    </motion.div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 h-5 w-40 animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-700/50" />
            <HistorySkeleton />
          </div>
        </main>
      }
    >
      <HistoryPageInner />
    </Suspense>
  );
}
