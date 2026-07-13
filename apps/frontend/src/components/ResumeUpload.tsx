"use client";

import { motion } from "framer-motion";
import { CheckCircle2, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

import { Button } from "@/components/ui/Button";
import { uploadResume } from "@/services/api";
import { cn, formatBytes } from "@/lib/utils";
import type { ResumeUploadResponse } from "@applyai/types";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
};

type Props = {
  fileId: string | null;
  onUploaded: (response: ResumeUploadResponse, file: File) => void;
  onReset: () => void;
};

export function ResumeUpload({ fileId, onUploaded, onReset }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const next = accepted[0];
      if (!next) return;
      setError(null);
      setFile(next);
      setUploading(true);
      const { data, error: err } = await uploadResume(next);
      setUploading(false);
      if (err || !data) {
        setError(err ?? "Upload failed");
        return;
      }
      onUploaded(data, next);
    },
    [onUploaded],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: false,
    maxSize: MAX_BYTES,
    onDropRejected: (rejections) => {
      const reason = rejections[0]?.errors[0]?.code;
      if (reason === "file-too-large") setError("File exceeds 5 MB limit");
      else if (reason === "file-invalid-type") setError("Only PDF, DOCX, or TXT allowed");
      else setError("File rejected");
    },
  });

  if (fileId && file) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 rounded-2xl border border-emerald-200 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-500/10 p-4"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{file.name}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {formatBytes(file.size)} • Ready
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFile(null);
            onReset();
          }}
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-all",
          isDragActive
            ? "border-violet-400 bg-violet-50 dark:bg-violet-500/10"
            : "border-slate-300 dark:border-slate-600/60 bg-white/50 dark:bg-slate-900/40 hover:border-violet-300 dark:hover:border-violet-600/50 hover:bg-white/80 dark:hover:bg-slate-900/60",
        )}
      >
        <input {...getInputProps()} />
        <div className="relative">
          <div className="absolute inset-0 -z-10 animate-pulse rounded-full bg-violet-400/20 blur-xl" />
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-500/20 dark:to-indigo-500/20 text-violet-600 dark:text-violet-400">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <UploadCloud className="h-6 w-6" />
            )}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {uploading
              ? "Uploading & parsing…"
              : isDragActive
              ? "Drop it here"
              : "Drag your resume or click to browse"}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            PDF, DOCX, or TXT • up to 5 MB
          </p>
        </div>
        {file && !fileId && !uploading && (
          <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800/60 px-3 py-1 text-xs text-slate-700 dark:text-slate-300">
            <FileText className="h-3.5 w-3.5" />
            <span className="max-w-[160px] truncate">{file.name}</span>
            <span className="text-slate-400 dark:text-slate-500">·</span>
            <span>{formatBytes(file.size)}</span>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
