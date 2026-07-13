"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  Send,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth-context";
import { requestGmailSendToken, sendViaGmail } from "@/lib/gmail";
import { draftEmail } from "@/services/api";
import type { EmailDraftPayload } from "@applyai/types";

type Props = {
  pipelineId: string;
};

export function EmailCompose({ pipelineId }: Props) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<EmailDraftPayload | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDraft = async () => {
    if (!email.includes("@")) {
      setError("Enter a valid email address");
      return;
    }
    setError(null);
    setDrafting(true);
    const { data, error: err } = await draftEmail({
      pipeline_id: pipelineId,
      to_email: email.trim(),
    });
    setDrafting(false);
    if (err || !data) {
      setError(err ?? "Could not draft email");
      return;
    }
    setDraft(data);
  };

  const openInGmail = () => {
    if (draft?.gmail_url) {
      window.open(draft.gmail_url, "_blank", "noopener,noreferrer");
    }
  };

  const sendNow = async () => {
    if (!draft || !user?.email) return;
    setError(null);
    setSending(true);
    try {
      const accessToken = await requestGmailSendToken();
      await sendViaGmail({
        accessToken,
        from: user.email,
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const initials = (draft?.to ?? email ?? "?")
    .replace(/@.*/, "")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Recruiter email
          </label>
          <Input
            type="email"
            placeholder="recruiter@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && email && !drafting) handleDraft();
            }}
          />
        </div>
        <Button onClick={handleDraft} disabled={drafting || !email}>
          {drafting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Drafting…
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" />
              {draft ? "Redraft" : "Draft email"}
            </>
          )}
        </Button>
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {drafting && !draft && (
        <div
          role="status"
          aria-label="Drafting email"
          className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700/60"
        >
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-800/40">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </div>
          <div className="px-4 py-4">
            <SkeletonText lines={5} />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {draft && (
          <motion.div
            key="draft"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70"
          >
            {/* email header — reads like a real client */}
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-800/40">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-xs font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>To</span>
                  <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                    {draft.to}
                  </span>
                </div>
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {draft.subject}
                </p>
              </div>
              {sent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Sent
                </span>
              )}
            </div>

            {/* body */}
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap px-4 py-4 font-sans text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {draft.body}
            </pre>

            {/* actions */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-800/30">
              <Button onClick={openInGmail}>
                <ExternalLink className="h-4 w-4" />
                Open in Gmail
              </Button>
              <Button
                onClick={sendNow}
                disabled={sending || sent}
                variant="outline"
              >
                {sent ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Sent
                  </>
                ) : sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send via Gmail
                  </>
                )}
              </Button>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Sending uses your Google account (gmail.send).
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
