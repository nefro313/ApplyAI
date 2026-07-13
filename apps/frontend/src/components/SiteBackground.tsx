"use client";

import { AnimatePresence, motion } from "framer-motion";

import DotGrid from "@/components/DotGrid";
import { useIsDark } from "@/lib/use-is-dark";

// Palettes are kept side-by-side so the contrast between modes stays obvious
// at a glance. Light: soft slate dots that pop violet on hover. Dark: the
// supplied near-black dots with a vibrant violet active state.
const LIGHT = { baseColor: "#CBD5E1", activeColor: "#7C3AED" };
const DARK = { baseColor: "#2F293A", activeColor: "#5227FF" };

export function SiteBackground() {
  const isDark = useIsDark();
  const palette = isDark ? DARK : LIGHT;
  const key = isDark ? "dark" : "light";

  return (
    <div
      aria-hidden
      // Dimmer dots on phones so content stays the focus and the grid feels
      // lighter; full strength from sm+.
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-50 sm:opacity-100"
    >
      {/* Wait for the outgoing palette to fade before mounting the next one
        so only one DotGrid (and its global mouse listeners) is live at a
        time. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <DotGrid
            dotSize={3}
            gap={18}
            baseColor={palette.baseColor}
            activeColor={palette.activeColor}
            proximity={120}
            shockRadius={250}
            shockStrength={5}
            resistance={750}
            returnDuration={1.5}
            className="!p-0"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
