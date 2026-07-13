import type { Metadata, Viewport } from "next";

// Type system — self-hosted via @fontsource (font files bundled in the build, no
// build-time fetch to Google Fonts, so `next build` works on hosts that can't
// reach fonts.gstatic.com). The font-family names these expose
// ('Inter Variable' / 'Sora Variable' / 'JetBrains Mono Variable') are wired to
// --font-sans / --font-display / --font-mono in globals.css.
//  · Inter          → UI / body text.
//  · Sora           → display / headings.
//  · JetBrains Mono → raw-document & code surfaces (resume / JD / email preview).
import "@fontsource-variable/inter";
import "@fontsource-variable/sora";
import "@fontsource-variable/jetbrains-mono";

import { SiteBackgroundGate } from "@/components/SiteBackgroundGate";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";

import "./globals.css";

export const metadata: Metadata = {
  title: "ApplyAI",
  description: "Job application automation platform",
};

// Correct mobile scaling + safe-area handling on notched phones. `viewportFit:
// "cover"` lets fixed backgrounds bleed under the notch/home indicator.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Runs before React hydrates. Reads the saved theme (defaults to light)
// and sets the matching class on <html> so the first paint is correct.
// Keeping it inline + minified avoids a flash on reload.
const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('applyai.theme');
    var theme = (stored === 'dark' || stored === 'light') ? stored : 'light';
    var html = document.documentElement;
    html.classList.toggle('dark', theme === 'dark');
    html.classList.toggle('light', theme === 'light');
  } catch (e) {
    document.documentElement.classList.add('light');
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // suppressHydrationWarning on <html>: THEME_INIT_SCRIPT sets the theme class
  // before React hydrates, so the client class intentionally differs from the
  // server-rendered markup. The flag only suppresses <html>'s own attribute diff.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <SiteBackgroundGate />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
