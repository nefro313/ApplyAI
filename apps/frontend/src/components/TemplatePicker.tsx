"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { ResumeTemplate } from "@applyai/types";

type TemplateOption = {
  id: ResumeTemplate;
  name: string;
  description: string;
  thumb: string;
};

const TEMPLATES: TemplateOption[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Serif, blue accents, three-column header.",
    thumb: "/templates/classic.png",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Bold Lato sans with blue small-caps section headers.",
    thumb: "/templates/minimal.png",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Bold sans-serif headings, high contrast.",
    thumb: "/templates/modern.png",
  },
];

type Props = {
  value: ResumeTemplate;
  onChange: (value: ResumeTemplate) => void;
};

const SWIPE_THRESHOLD = 60;

const slide = {
  enter: (dir: number) => ({ x: dir >= 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? -80 : 80, opacity: 0 }),
};

/**
 * One-template-at-a-time carousel: a large, legible preview with slide
 * animation, swipe + arrow navigation, and labeled pills to jump straight to
 * a style. The visible template IS the selection — confirming the dialog
 * uses whatever is on stage, so there's no separate "select" tap.
 */
export function TemplatePicker({ value, onChange }: Props) {
  const index = Math.max(0, TEMPLATES.findIndex((t) => t.id === value));
  const current = TEMPLATES[index];
  // Last navigation direction, so enter/exit slides match the arrow pressed.
  const [direction, setDirection] = useState(1);

  const goTo = (nextIndex: number, dir: number) => {
    setDirection(dir);
    onChange(TEMPLATES[nextIndex].id);
  };
  const step = (delta: number) =>
    goTo((index + delta + TEMPLATES.length) % TEMPLATES.length, delta);

  return (
    <div
      className="space-y-3"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          step(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          step(1);
        }
      }}
    >
      {/* Stage — full-page preview, height capped to the viewport so the
          modal fits on phones. */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100/80 dark:border-slate-700/60 dark:bg-slate-800/40">
        <div className="relative h-[42vh] min-h-[260px] sm:h-[48vh] sm:max-h-[460px]">
          <AnimatePresence mode="popLayout" custom={direction} initial={false}>
            <motion.div
              key={current.id}
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: "easeOut" }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x < -SWIPE_THRESHOLD) step(1);
                else if (info.offset.x > SWIPE_THRESHOLD) step(-1);
              }}
              className="absolute inset-0 cursor-grab p-2 active:cursor-grabbing sm:p-3"
            >
              <Image
                src={current.thumb}
                alt={`${current.name} resume template preview`}
                fill
                sizes="(max-width: 640px) 100vw, 560px"
                draggable={false}
                className="pointer-events-none select-none object-contain drop-shadow-md"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur dark:bg-slate-100/80 dark:text-slate-900">
          {index + 1} / {TEMPLATES.length}
        </span>

        <button
          type="button"
          aria-label="Previous template"
          onClick={() => step(-1)}
          className="absolute left-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/85 text-slate-600 shadow-md backdrop-blur transition hover:border-violet-300 hover:text-violet-700 dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-violet-600/50 dark:hover:text-violet-300 ring-focus"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Next template"
          onClick={() => step(1)}
          className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/85 text-slate-600 shadow-md backdrop-blur transition hover:border-violet-300 hover:text-violet-700 dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-violet-600/50 dark:hover:text-violet-300 ring-focus"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Style pills — jump straight to a template; the active one is the
          selection. */}
      <div
        role="radiogroup"
        aria-label="Resume template"
        className="flex flex-wrap items-center justify-center gap-1.5"
      >
        {TEMPLATES.map((tpl, i) => {
          const selected = tpl.id === value;
          return (
            <button
              key={tpl.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => goTo(i, i >= index ? 1 : -1)}
              className={cn(
                "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ring-focus",
                selected
                  ? "border-violet-500 bg-violet-600 text-white shadow-sm"
                  : "border-slate-200 bg-white/70 text-slate-600 hover:border-violet-300 hover:text-violet-700 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:border-violet-600/50 dark:hover:text-violet-300",
              )}
            >
              {selected && <Check className="h-3.5 w-3.5" />}
              {tpl.name}
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        {current.description}
      </p>
    </div>
  );
}
