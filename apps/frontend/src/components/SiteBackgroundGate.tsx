"use client";

import { usePathname } from "next/navigation";

import { AuthBackground } from "@/components/AuthBackground";
import { HomeBackground } from "@/components/HomeBackground";
import { SiteBackground } from "@/components/SiteBackground";

// Landing + auth pages get the animated orb backdrop; /home gets the premium
// aurora + dot-grid hero backdrop; the rest of the app keeps the plain dot grid
// so content stays readable over a denser background. Centralised here so
// future surfaces can opt into a different background by adding a prefix.
const ORB_PREFIXES = ["/login", "/signup"];

export function SiteBackgroundGate() {
  const pathname = usePathname() ?? "";
  const isOrb =
    pathname === "/" || ORB_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isOrb) return <AuthBackground />;
  if (pathname === "/home") return <HomeBackground />;
  return <SiteBackground />;
}
