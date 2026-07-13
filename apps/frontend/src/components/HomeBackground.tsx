"use client";

import DotGrid from "@/components/DotGrid";
import { useIsDark } from "@/lib/use-is-dark";

// Premium AI/SaaS hero backdrop for /home, layered per spec:
//   1. dark radial base (dark mode) for depth + contrast
//   2. blurred aurora blooms (electric blue / violet / soft cyan) drifting up
//      from the bottom corners — pure CSS, GPU-composited
//   3. the app's interactive dot grid on top, so /home still feels of-a-piece
//      with the pipeline page
// Theme-aware: vivid over near-black in dark mode; a soft pastel wash that
// keeps the page light + readable in light mode. The whole stack is
// pointer-events-none, but DotGrid listens on window so it stays interactive.

// Dots tinted toward the spec's technical-blue grid in dark mode; the existing
// slate→violet pairing is kept for light mode.
const LIGHT_DOTS = { baseColor: "#CBD5E1", activeColor: "#7C3AED" };
const DARK_DOTS = { baseColor: "#1E2A44", activeColor: "#60A5FA" };

// Aurora palette (shared across themes); only the opacity changes per mode so
// the glow creates atmosphere rather than becoming the focal point.
const BLUE = "#60A5FA";
const VIOLET = "#A78BFA";
const CYAN = "#67E8F9";

export function HomeBackground() {
  const isDark = useIsDark();
  const dots = isDark ? DARK_DOTS : LIGHT_DOTS;
  const glow = isDark
    ? { blue: 0.5, violet: 0.45, cyan: 0.3 }
    : { blue: 0.22, violet: 0.2, cyan: 0.14 };

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* 1 · dark radial base */}
      {isDark && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 50% 32%, #060B1A 0%, #030616 45%, #020308 100%)",
          }}
        />
      )}

      {/* 2 · aurora blooms — lighter blur + dimmer on phones (cheaper to
            composite on low-end devices, and keeps content the focus). */}
      <div className="absolute inset-0 opacity-70 sm:opacity-100">
        <div
          data-aurora
          className="absolute -bottom-[20%] -left-[12%] h-[70svh] w-[60vw] rounded-full blur-[80px] sm:blur-[150px]"
          style={{
            background: `radial-gradient(circle at center, ${BLUE} 0%, transparent 70%)`,
            opacity: glow.blue,
            animation: "home-aurora-a 22s ease-in-out infinite",
            willChange: "transform",
          }}
        />
        <div
          data-aurora
          className="absolute -bottom-[24%] -right-[12%] h-[72svh] w-[60vw] rounded-full blur-[85px] sm:blur-[160px]"
          style={{
            background: `radial-gradient(circle at center, ${VIOLET} 0%, transparent 70%)`,
            opacity: glow.violet,
            animation: "home-aurora-b 27s ease-in-out infinite",
            willChange: "transform",
          }}
        />
        <div
          data-aurora
          className="absolute -bottom-[30%] left-1/2 h-[55svh] w-[52vw] rounded-full blur-[90px] sm:blur-[170px]"
          style={{
            background: `radial-gradient(circle at center, ${CYAN} 0%, transparent 70%)`,
            opacity: glow.cyan,
            animation: "home-aurora-c 30s ease-in-out infinite",
            willChange: "transform",
          }}
        />
      </div>

      {/* 3 · interactive dot grid overlay (dimmer on phones) */}
      <div className="absolute inset-0 opacity-60 sm:opacity-100">
        <DotGrid
          dotSize={3}
          gap={18}
          baseColor={dots.baseColor}
          activeColor={dots.activeColor}
          proximity={120}
          shockRadius={250}
          shockStrength={5}
          resistance={750}
          returnDuration={1.5}
          className="!p-0"
        />
      </div>
    </div>
  );
}
