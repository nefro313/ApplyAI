"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export type AccordionItem = {
  id: string;
  /** Left-side header content (string or rich node, e.g. with a badge). */
  title: React.ReactNode;
  /** Optional muted line under the title. */
  subtitle?: React.ReactNode;
  /** Optional node rendered on the header's right, before the chevron. */
  trailing?: React.ReactNode;
  content: React.ReactNode;
};

type Props = {
  items: AccordionItem[];
  /** When true (default) opening one row closes the others. */
  singleOpen?: boolean;
  defaultOpenId?: string | null;
  className?: string;
};

/**
 * Mobile-friendly accordion. Rows collapse by default to keep long result
 * sections (insights, roadmap, interview Q&A) short on phones. Headers are a
 * 44px touch target and use the app's glass surface + chevron idiom.
 */
export function Accordion({
  items,
  singleOpen = true,
  defaultOpenId = null,
  className,
}: Props) {
  const [open, setOpen] = useState<string[]>(
    defaultOpenId ? [defaultOpenId] : [],
  );
  const isOpen = (id: string) => open.includes(id);
  const toggle = (id: string) =>
    setOpen((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : singleOpen
          ? [id]
          : [...prev, id],
    );

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((it) => {
        const expanded = isOpen(it.id);
        return (
          <div
            key={it.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white/60 dark:border-slate-700/60 dark:bg-slate-900/50"
          >
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => toggle(it.id)}
              className="ring-focus flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                  {it.title}
                </span>
                {it.subtitle && (
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    {it.subtitle}
                  </span>
                )}
              </span>
              {it.trailing}
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-slate-400 transition-transform dark:text-slate-500",
                  expanded && "rotate-180",
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-700/60">
                    {it.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
