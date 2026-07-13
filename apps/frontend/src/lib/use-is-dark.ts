"use client";

import { useEffect, useState } from "react";

/**
 * `true` when the site should render in dark mode. Resolution order:
 *   1. `<html class="dark">` (explicit toggle wins)
 *   2. `<html class="light">` (explicit toggle wins)
 *   3. OS `prefers-color-scheme: dark`
 *
 * Reacts to both the OS preference changing and the class on `<html>`
 * flipping — so any future theme toggle that adds/removes the class
 * is picked up automatically.
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const compute = () => {
      if (html.classList.contains("dark")) return true;
      if (html.classList.contains("light")) return false;
      return mq.matches;
    };

    setIsDark(compute());

    const onMq = () => setIsDark(compute());
    mq.addEventListener("change", onMq);

    const mo = new MutationObserver(() => setIsDark(compute()));
    mo.observe(html, { attributes: true, attributeFilter: ["class"] });

    return () => {
      mq.removeEventListener("change", onMq);
      mo.disconnect();
    };
  }, []);

  return isDark;
}
