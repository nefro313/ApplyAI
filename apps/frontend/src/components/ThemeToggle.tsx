"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/lib/theme-context";

/**
 * Small icon-only toggle that swaps between light and dark with a soft
 * rotate/scale crossfade. Matches the glass-pill chrome used by the rest
 * of the navbar.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        toggleTheme({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className={
        "relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white/70 text-slate-600 shadow-sm backdrop-blur transition hover:border-violet-300 hover:bg-violet-50/70 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-violet-400 dark:hover:bg-violet-500/10 dark:hover:text-violet-300 " +
        (className ?? "")
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="moon"
            initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.2 }}
            className="flex"
          >
            <Moon className="h-4 w-4" />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ rotate: 90, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -90, opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.2 }}
            className="flex"
          >
            <Sun className="h-4 w-4" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
