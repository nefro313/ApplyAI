"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const DEFAULT_ACCENT =
  "bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600";

/**
 * Marketing hero shared by the landing page and the tailor flow at /home.
 * The headline is intentionally identical across both surfaces — kept here
 * so a copy tweak in one place updates both. `accentClassName` lets a surface
 * (e.g. /home in dark mode) swap the "60 seconds" gradient.
 */
export function Hero({
  subtitle,
  accentClassName,
}: {
  subtitle?: string;
  accentClassName?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 dark:border-violet-700/40 bg-violet-50 dark:bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300"
      >
        <Sparkles className="h-3 w-3" />
        Powered by AI Agents
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="text-balance text-[28px] font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl"
      >
        Tailor your resume in{" "}
        <span
          className={cn(
            DEFAULT_ACCENT,
            "bg-clip-text text-transparent",
            accentClassName,
          )}
        >
          60 seconds
        </span>
      </motion.h1>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-5 max-w-2xl text-balance text-base text-slate-600 dark:text-slate-400 sm:text-lg"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
