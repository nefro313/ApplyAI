"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark";

/** Where the circular reveal should originate from (viewport px). */
export type ThemeOrigin = { x: number; y: number };

type ThemeState = {
  theme: Theme;
  setTheme: (next: Theme, origin?: ThemeOrigin) => void;
  toggleTheme: (origin?: ThemeOrigin) => void;
};

const STORAGE_KEY = "applyai.theme";

const ThemeContext = createContext<ThemeState | null>(null);

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  // Toggle both classes explicitly so prefers-color-scheme can never
  // override a user choice.
  html.classList.toggle("dark", theme === "dark");
  html.classList.toggle("light", theme === "light");
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Apply the theme with a circular reveal that wipes out from `origin` (the
 * toggle button). Uses the View Transitions API where available; otherwise the
 * class is swapped instantly and the body's `transition-colors` handles the
 * crossfade. Honours prefers-reduced-motion.
 */
function applyThemeAnimated(theme: Theme, origin?: ThemeOrigin) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void> };
  };

  if (!origin || prefersReducedMotion() || typeof doc.startViewTransition !== "function") {
    applyTheme(theme);
    return;
  }

  const transition = doc.startViewTransition(() => applyTheme(theme));

  transition.ready
    .then(() => {
      const { x, y } = origin;
      // Largest distance from the origin to a viewport corner = final radius.
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 480,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {
      // View transition can reject if interrupted — the class swap already ran.
    });
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // localStorage can throw in private/quota cases — fall through.
  }
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Hydrate from storage and reflect on <html> on mount. An inline script
  // in the document <head> handles the initial class to prevent a flash —
  // this effect keeps React state aligned for the rest of the session.
  useEffect(() => {
    const initial = readStoredTheme();
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = useCallback((next: Theme, origin?: ThemeOrigin) => {
    setThemeState(next);
    applyThemeAnimated(next, origin);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persistence is best-effort.
    }
  }, []);

  const toggleTheme = useCallback(
    (origin?: ThemeOrigin) => {
      setTheme(theme === "dark" ? "light" : "dark", origin);
    },
    [theme, setTheme],
  );

  const value = useMemo<ThemeState>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
