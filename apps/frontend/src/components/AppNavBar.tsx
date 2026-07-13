"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, History, LogIn, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

/**
 * Top-right navigation used on the app pages (and the landing page). From sm+
 * it renders a History link, the signed-in user's profile chip with a hover
 * popover showing the email, and a sign-out icon button. On phones those
 * collapse into a single avatar button that opens a dropdown menu (account
 * info + History + Sign out) so the bar never squishes against the logo.
 * Falls back to a "Sign in" link when the visitor isn't authenticated, so
 * the same nav works on the public landing page.
 */
export function AppNavBar() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the mobile menu on outside tap / Escape (same pattern as DownloadMenu).
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!user) {
    return (
      <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
        <ThemeToggle />
        <Link
          href="/login"
          className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/60 px-2.5 py-1.5 text-xs sm:px-4 sm:text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm backdrop-blur transition hover:border-violet-300 dark:hover:border-violet-600/50 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300 whitespace-nowrap"
        >
          <LogIn className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">Sign in</span>
        </Link>
      </nav>
    );
  }

  const displayName =
    (user.displayName && user.displayName.trim()) ||
    (user.email ? user.email.split("@")[0] : "Guest");

  return (
    <nav className="flex items-center gap-2">
      {/* Desktop row — full pill chrome, hidden on phones. */}
      <div className="hidden items-center gap-2 sm:flex">
        <NavLink href="/history" icon={<History className="h-3.5 w-3.5" />}>
          History
        </NavLink>

        <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />

        <ThemeToggle />

        <UserChip
          displayName={displayName}
          userEmail={user.email}
          userPhoto={user.photoURL}
        />

        <button
          type="button"
          onClick={() => void signOut()}
          title="Sign out"
          aria-label="Sign out"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 shadow-sm backdrop-blur transition hover:border-rose-300 dark:hover:border-rose-700/40 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {/* Phone: theme toggle + avatar button that opens the account menu. */}
      <div ref={menuRef} className="relative flex items-center gap-2 sm:hidden">
        <ThemeToggle />

        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Open account menu"
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/60 py-1 pl-1 pr-2 shadow-sm backdrop-blur transition hover:border-violet-300 dark:hover:border-violet-600/50"
        >
          <Avatar displayName={displayName} userPhoto={user.photoURL} />
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-slate-500 dark:text-slate-400 transition-transform",
              menuOpen && "rotate-180",
            )}
          />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full z-30 mt-2 w-60 max-w-[calc(100vw-2rem)] origin-top-right overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 shadow-xl backdrop-blur"
            >
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 px-4 py-3">
                <Avatar displayName={displayName} userPhoto={user.photoURL} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {displayName}
                  </p>
                  {user.email && (
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-1.5">
                <Link
                  href="/history"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300"
                >
                  <History className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  History
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void signOut();
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                >
                  <LogOut className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  Sign out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/60 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm backdrop-blur transition hover:border-violet-300 dark:hover:border-violet-600/50 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300"
    >
      <span className="text-slate-400 dark:text-slate-500 transition group-hover:text-violet-500 dark:group-hover:text-violet-400">
        {icon}
      </span>
      {children}
    </Link>
  );
}

function UserChip({
  displayName,
  userEmail,
  userPhoto,
}: {
  displayName: string;
  userEmail: string | null;
  userPhoto: string | null;
}) {
  return (
    <div className="group relative">
      <div
        tabIndex={0}
        className="inline-flex cursor-default items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/60 py-1 pl-1 pr-3 shadow-sm backdrop-blur transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
      >
        <Avatar displayName={displayName} userPhoto={userPhoto} />
        <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-300 sm:inline">
          {displayName}
        </span>
      </div>

      {userEmail && (
        <div
          role="tooltip"
          className="pointer-events-none absolute right-0 top-full z-10 mt-2 max-w-[calc(100vw-1rem)] origin-top-right scale-95 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/90 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 opacity-0 shadow-lg backdrop-blur transition duration-150 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100"
        >
          <p className="font-semibold text-slate-900 dark:text-slate-100">{displayName}</p>
          <p className="text-slate-500 dark:text-slate-400">{userEmail}</p>
        </div>
      )}
    </div>
  );
}

function Avatar({
  displayName,
  userPhoto,
}: {
  displayName: string;
  userPhoto: string | null;
}) {
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (userPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={userPhoto}
        alt={displayName}
        referrerPolicy="no-referrer"
        className="h-7 w-7 rounded-full ring-2 ring-white dark:ring-slate-800"
      />
    );
  }

  if (initials) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-[11px] font-semibold text-white ring-2 ring-white dark:ring-slate-800">
        {initials}
      </span>
    );
  }

  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white ring-2 ring-white dark:ring-slate-800">
      <UserRound className="h-3.5 w-3.5" />
    </span>
  );
}
