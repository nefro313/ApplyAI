"use client";

import Link from "next/link";

import { Logo } from "@/components/ui/Logo";

// Brand glyphs as inline SVGs — lucide dropped its brand icons over trademark
// concerns, so we ship minimal marks here. Each fills `currentColor`.
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.4 11.4 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.23 1.92 1.23 3.23 0 4.62-2.8 5.64-5.48 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

/**
 * Site-wide marketing footer. Rendered at the bottom of the public landing
 * page. Four columns on desktop (brand + three link groups) that collapse to a
 * stacked layout on phones, plus a legal/credit bar. Links point at real app
 * routes and in-page feature anchors; legal placeholders use `#` until those
 * pages ship.
 */

type FooterLink = { label: string; href: string; external?: boolean };

const PRODUCT: FooterLink[] = [
  { label: "Tailor a resume", href: "/home" },
  { label: "Resume templates", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Your history", href: "/history" },
];

const FEATURES: FooterLink[] = [
  { label: "ATS scorecard", href: "/#features" },
  { label: "Cover letters", href: "/#features" },
  { label: "Interview prep", href: "/#features" },
  { label: "Recruiter review", href: "/#features" },
];

const RESOURCES: FooterLink[] = [
  { label: "Sign in", href: "/login" },
  { label: "Create account", href: "/signup" },
  { label: "Contact us", href: "mailto:hello@applyai.app", external: true },
  { label: "Privacy & Terms", href: "#" },
];

const SOCIALS: {
  label: string;
  href: string;
  icon: (props: { className?: string }) => React.ReactElement;
}[] = [
  {
    label: "GitHub",
    href: "https://github.com/nefro313/ApplyAI",
    icon: GithubIcon,
  },
  { label: "Twitter / X", href: "https://x.com/robinkphil", icon: XIcon },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/robinkphilip",
    icon: LinkedinIcon,
  },
  { label: "Email", href: "mailto:hello@applyai.app", icon: MailIcon },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-20 border-t border-slate-200/70 dark:border-white/10">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-10">
          {/* Brand column */}
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" aria-label="ApplyAI home" className="inline-block">
              <Logo variant="primary" className="h-11 w-auto" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              A team of AI agents that tailors your resume, scores it against the
              ATS, and hands you offer-ready documents in under a minute.
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              For feature requests — or just to say hello — reach out any time.
            </p>

            <div className="mt-5 flex items-center gap-2">
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={label}
                  title={label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 shadow-sm backdrop-blur transition hover:border-violet-300 dark:hover:border-violet-600/50 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <FooterColumn title="Product" links={PRODUCT} />
          <FooterColumn title="Features" links={FEATURES} />
          <FooterColumn title="Account" links={RESOURCES} />
        </div>

        {/* Legal / credit bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200/70 dark:border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            © {year} ApplyAI · Built by Robin K Philip. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-xs text-slate-500 dark:text-slate-400">
            <Link href="#" className="transition hover:text-violet-600 dark:hover:text-violet-300">
              Privacy
            </Link>
            <Link href="#" className="transition hover:text-violet-600 dark:hover:text-violet-300">
              Terms
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            {link.external || link.href.startsWith("#") ? (
              <a
                href={link.href}
                className="text-sm text-slate-600 dark:text-slate-400 transition hover:text-violet-600 dark:hover:text-violet-300"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="text-sm text-slate-600 dark:text-slate-400 transition hover:text-violet-600 dark:hover:text-violet-300"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
