"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";

import { useIsDark } from "@/lib/use-is-dark";

// The Orb is WebGL (ogl) and can only paint after hydration. Loading it lazily
// (ssr:false) keeps that heavy bundle off the critical hydration path so the
// hero content reveals fast on a cold load; the static gradient wash below
// fills the frame until the canvas mounts, so the backdrop is never blank.
const Orb = dynamic(() => import("@/components/Orb"), { ssr: false });

// Background bg-color the Orb shader composites against. Picked to match
// the body bg-color from globals.css so the orb feels seamless with the
// rest of the page chrome.
const LIGHT_BG = "#f8fafc"; // slate-50
const DARK_BG = "#020617"; // slate-950

export function AuthBackground() {
  const isDark = useIsDark();

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Static gradient wash painted immediately (CSS, no JS) so there is an
        intentional backdrop before — or if — the WebGL orb mounts. */}
      <div
        className={
          isDark
            ? "absolute inset-0 bg-slate-950 bg-[radial-gradient(60%_60%_at_50%_40%,rgba(82,39,255,0.18),transparent_70%)]"
            : "absolute inset-0 bg-slate-50 bg-[radial-gradient(60%_60%_at_50%_40%,rgba(124,58,237,0.12),transparent_70%)]"
        }
      />
      {/* Crossfade the orb (and its WebGL context) when the theme flips. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isDark ? "dark" : "light"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <Orb
            backgroundColor={isDark ? DARK_BG : LIGHT_BG}
            hue={0}
            hoverIntensity={2}
            rotateOnHover={false}
            forceHoverState
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
