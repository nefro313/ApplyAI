"use client";

import { motion } from "framer-motion";
import { ArrowRight, Loader2, LogIn, Sparkles, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

const COPY: Record<
  Mode,
  {
    eyebrow: string;
    title: string;
    accent: string;
    subtitle: string;
    cta: string;
    busy: string;
    altPrompt: string;
    altCta: string;
    altHref: string;
  }
> = {
  login: {
    eyebrow: "Welcome back",
    title: "Sign in to keep",
    accent: "Tailoring Applications",
    subtitle:
      "One click with Google and you're back where you left off — your resumes, history, and tailored PDFs.",
    cta: "Continue with Google",
    busy: "Signing in…",
    altPrompt: "No account yet?",
    altCta: "Sign up",
    altHref: "/signup",
  },
  signup: {
    eyebrow: "Get started",
    title: "Tailor your first",
    accent: "Resume in 60 Seconds",
    subtitle:
      "Sign up with Google to save your applications, browse your history, and pick up where you left off across devices.",
    cta: "Sign up with Google",
    busy: "Creating account…",
    altPrompt: "Already have an account?",
    altCta: "Sign in",
    altHref: "/login",
  },
};

export function GoogleAuthPanel({ mode }: { mode: Mode }) {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const next = search?.get("next") ?? "/home";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[mode];

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      router.replace(next);
    } catch (e) {
      // Don't surface raw Firebase strings ("Firebase: Error (auth/…)"). Show
      // calm copy; the real code stays in the console for debugging.
      if (process.env.NODE_ENV !== "production") console.warn("[auth] sign-in", e);
      const code = (e as { code?: string })?.code ?? "";
      if (
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
        setError("Sign-in was cancelled. Please try again.");
      } else if (code === "auth/popup-blocked") {
        setError("Your browser blocked the sign-in popup. Allow popups and try again.");
      } else if (code === "auth/network-request-failed") {
        setError("Can't reach Google right now. Check your connection and try again.");
      } else {
        setError("Couldn't sign in to Google. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  // Preserve the post-auth redirect target across the nav links too, so a
  // visitor who deep-linked into /login?next=… keeps it when hopping to /signup.
  const withNext = (href: string) =>
    next === "/home" ? href : `${href}?next=${encodeURIComponent(next)}`;
  const altHref = withNext(copy.altHref);

  return (
    <main className="relative flex min-h-screen flex-col px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link href="/" aria-label="ApplyAI home">
          <Logo
            variant="primary"
            priority
            className="h-12 w-auto sm:h-16"
          />
        </Link>
        <nav className="flex items-center gap-2">
          {/* Show only the *other* path: Sign up on the login page, Log in on
              the signup page. */}
          <NavAuthLink
            href={altHref}
            icon={
              mode === "login" ? (
                <UserPlus className="h-3.5 w-3.5" />
              ) : (
                <LogIn className="h-3.5 w-3.5" />
              )
            }
            primary
          >
            {copy.altCta}
          </NavAuthLink>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center py-8 text-center sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 dark:border-violet-700/40 bg-violet-50 dark:bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300"
        >
          <Sparkles className="h-3 w-3" />
          {copy.eyebrow}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="text-balance text-[28px] font-bold leading-[1.15] tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl md:text-6xl"
        >
          {copy.title}{" "}
          <span className="relative inline-block sm:whitespace-nowrap">
            <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 bg-clip-text text-transparent">
              {copy.accent}
            </span>
            <Sparkles
              aria-hidden
              className="absolute -right-3 -top-2 h-5 w-5 text-fuchsia-400 dark:text-fuchsia-300 drop-shadow-[0_0_10px_rgba(217,70,239,0.45)]"
            />
            <Sparkles
              aria-hidden
              className="absolute -bottom-1 -left-3 h-3.5 w-3.5 text-violet-400 dark:text-violet-300 drop-shadow-[0_0_8px_rgba(139,92,246,0.45)]"
            />
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mx-auto mt-6 max-w-xl text-balance text-base text-slate-600 dark:text-slate-400 sm:text-lg"
        >
          {copy.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mx-auto mt-10 w-full max-w-md"
        >
          <button
            type="button"
            disabled={busy || loading}
            onClick={handleGoogle}
            className="group inline-flex h-14 w-full items-center justify-center gap-3 rounded-full border border-slate-200/80 dark:border-slate-700/60 bg-white/85 dark:bg-slate-900/70 px-6 text-base font-semibold text-slate-900 dark:text-slate-100 shadow-[0_12px_28px_-12px_rgba(15,23,42,0.25)] backdrop-blur transition hover:border-violet-300 dark:hover:border-violet-500/50 hover:shadow-[0_14px_32px_-12px_rgba(99,102,241,0.4)] active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
          >
            {busy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {copy.busy}
              </>
            ) : (
              <>
                <GoogleMark />
                {copy.cta}
                <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </>
            )}
          </button>
          {error && (
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
        </motion.div>
      </section>
    </main>
  );
}

// Top-right auth nav pills. `primary` renders the gradient CTA (Sign up);
// otherwise an outline pill (Log in). `active` rings the button for the page
// you're currently on so the nav doubles as a "you are here" indicator.
function NavAuthLink({
  href,
  icon,
  children,
  active = false,
  primary = false,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium shadow-sm transition",
        primary
          ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700"
          : "border border-slate-200 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 backdrop-blur hover:border-violet-300 dark:hover:border-violet-600/50 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300",
        active &&
          "ring-2 ring-violet-500/40 ring-offset-2 ring-offset-white dark:ring-offset-slate-950",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

// Inline Google "G" mark so we don't depend on a brand-asset CDN. Colors
// match Google's brand guidelines.
function GoogleMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 18 18"
      className="h-5 w-5"
    >
      <path
        fill="#EA4335"
        d="M9 3.48c1.69 0 2.84.73 3.49 1.34l2.56-2.5C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"
      />
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#FBBC05"
        d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.52-1.78.88-3.12.88-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z"
      />
      <path fill="none" d="M0 0h18v18H0z" />
    </svg>
  );
}
