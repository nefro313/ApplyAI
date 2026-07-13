"use client";

import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingPanel } from "@/components/ui/LoadingPanel";
import { getResumeRisks } from "@/services/api";
import type { ResumeRisks as Risks, RiskSeverity } from "@applyai/types";

type Props = {
  pipelineId: string;
  initial?: Risks | null;
  /** Lifts a freshly generated scan up to the parent so it survives tab switches. */
  onGenerated?: (risks: Risks) => void;
};

const SEVERITY_TONE: Record<RiskSeverity, "missing" | "warning" | "info"> = {
  high: "warning",
  medium: "info",
  low: "missing",
};

const prettyType = (t: string) =>
  t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function ResumeRisks({ pipelineId, initial, onGenerated }: Props) {
  // Seed from the cached value on the result, if it was already generated.
  const [data, setData] = useState<Risks | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    const { data: res, error: err } = await getResumeRisks(pipelineId);
    setBusy(false);
    if (err || !res) setError(err ?? "Could not scan the resume");
    else {
      setData(res);
      onGenerated?.(res);
    }
  };

  if (busy) {
    return (
      <LoadingPanel
        title="Scanning for resume risks"
        subtitle="Looking for weak spots, gaps, and red flags a reviewer might catch."
      />
    );
  }

  if (!data) {
    return (
      <Card className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <ShieldCheck className="h-4 w-4 text-violet-500 dark:text-violet-400" />
          Scan for resume risks
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-rose-500">{error}</span>}
          <Button onClick={load} disabled={busy} variant="outline">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning…
              </>
            ) : (
              "Generate"
            )}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <ShieldCheck className="h-4 w-4 text-violet-500 dark:text-violet-400" />
        Resume risk detector
      </div>
      {data.summary && (
        <p className="text-sm text-slate-600 dark:text-slate-400">{data.summary}</p>
      )}
      {data.risks.length === 0 ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          No significant risks found — this resume is in good shape.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.risks.map((r, i) => (
            <li
              key={i}
              className="rounded-2xl border border-slate-200 dark:border-slate-700/60 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {prettyType(r.type)}
                </span>
                <Badge tone={SEVERITY_TONE[r.severity]}>{r.severity}</Badge>
              </div>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                {r.detail}
              </p>
              {r.fix && (
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                  Fix: {r.fix}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
