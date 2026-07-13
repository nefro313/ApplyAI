"use client";

import { cn } from "@/lib/utils";

type TabsProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  // Override the active-tab styling (e.g. a gradient pill on /home).
  activeClassName?: string;
};

export function Tabs<T extends string>({
  value,
  onValueChange,
  options,
  className,
  activeClassName,
}: TabsProps<T>) {
  return (
    // On phones the pill goes full-width and wraps onto extra rows so every
    // tab stays visible and tappable; from sm+ it shrinks to content so a
    // centering parent can center it.
    <div className="w-full sm:w-auto">
      <div
        className={cn(
          "relative flex flex-wrap gap-1 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/60 p-1 sm:inline-flex sm:flex-nowrap sm:gap-0",
          className,
        )}
        role="tablist"
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onValueChange(opt.value)}
              className={cn(
                "relative z-10 inline-flex flex-auto items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ring-focus min-h-[44px] sm:min-h-0 sm:flex-none sm:px-4 sm:py-1.5",
                active
                  ? cn(
                      "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm",
                      activeClassName,
                    )
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
