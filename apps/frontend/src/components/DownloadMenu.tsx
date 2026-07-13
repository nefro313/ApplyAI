"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Download, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Format = {
  key: string;
  label: string;
  description?: string;
  url: string;
  filename?: string;
  icon?: React.ReactNode;
};

type Props = {
  label?: string;
  formats: Format[];
  // Wrapper override (e.g. `flex` to stretch inside a grid cell).
  className?: string;
  // Applied to both halves of the split button (e.g. `h-12` hero sizing).
  buttonClassName?: string;
};

export function DownloadMenu({
  label = "Download resume",
  formats,
  className,
  buttonClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const usable = formats.filter((f) => f.url);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (usable.length === 0) return null;

  const primary = usable[0];

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <a
        href={primary.url}
        download={primary.filename}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-l-xl bg-gradient-to-br from-violet-600 to-indigo-600 px-4 text-sm font-medium text-white shadow-[0_4px_14px_-2px_rgba(99,102,241,0.45)] transition hover:from-violet-500 hover:to-indigo-500",
          buttonClassName,
        )}
      >
        <Download className="h-4 w-4" />
        {label}
      </a>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-r-xl border-l border-white/20 bg-gradient-to-br from-violet-600 to-indigo-600 px-2 text-white transition hover:from-violet-500 hover:to-indigo-500",
          buttonClassName,
        )}
      >
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-xl"
          >
            <p className="px-4 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Choose format
            </p>
            <ul className="pb-2">
              {usable.map((f) => (
                <li key={f.key}>
                  <a
                    href={f.url}
                    download={f.filename}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 transition hover:bg-violet-50 dark:hover:bg-violet-500/10"
                    role="menuitem"
                  >
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300">
                      {f.icon ?? <FileText className="h-3.5 w-3.5" />}
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium leading-tight">
                        {f.label}
                      </span>
                      {f.description && (
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                          {f.description}
                        </span>
                      )}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
