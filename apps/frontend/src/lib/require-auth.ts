"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth-context";

/**
 * Bounce unauthenticated visitors to `/login?next=<currentUrl>`. Used by
 * every page that lives behind the app shell (/home, /history,
 * /pipeline/[id]).
 */
export function useRequireAuth(): ReturnType<typeof useAuth> {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (auth.loading || auth.user) return;
    const query = search?.toString();
    const here = query ? `${pathname}?${query}` : (pathname ?? "/home");
    router.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [auth.loading, auth.user, pathname, search, router]);

  return auth;
}
