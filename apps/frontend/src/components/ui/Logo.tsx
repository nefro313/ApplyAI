import Image from "next/image";

import { cn } from "@/lib/utils";

type Variant = "primary" | "nav" | "icon" | "wordmark" | "dark";

const VARIANTS: Record<
  Variant,
  { src: string; width: number; height: number; alt: string }
> = {
  primary: {
    src: "/logo-primary.svg",
    width: 320,
    height: 80,
    alt: "ApplyAI",
  },
  nav: {
    src: "/logo-nav.svg",
    width: 160,
    height: 40,
    alt: "ApplyAI",
  },
  icon: {
    src: "/logo-icon.svg",
    width: 64,
    height: 64,
    alt: "ApplyAI",
  },
  wordmark: {
    src: "/logo-wordmark.svg",
    width: 220,
    height: 50,
    alt: "ApplyAI",
  },
  dark: {
    src: "/logo-dark.svg",
    width: 320,
    height: 80,
    alt: "ApplyAI",
  },
};

interface LogoProps {
  variant?: Variant;
  className?: string;
  priority?: boolean;
}

export function Logo({ variant = "nav", className, priority }: LogoProps) {
  // For `primary` we want the dark-mode lockup to swap to `logo-dark.svg`
  // (the asset designed to read on a dark canvas). Render both and let the
  // `dark:` class on <html> toggle which one is visible — avoids a flash
  // and a hydration mismatch.
  if (variant === "primary") {
    return (
      <>
        <Image
          src={VARIANTS.primary.src}
          alt={VARIANTS.primary.alt}
          width={VARIANTS.primary.width}
          height={VARIANTS.primary.height}
          priority={priority}
          className={cn("h-auto select-none block dark:hidden", className)}
        />
        <Image
          src={VARIANTS.dark.src}
          alt={VARIANTS.dark.alt}
          width={VARIANTS.dark.width}
          height={VARIANTS.dark.height}
          priority={priority}
          className={cn("h-auto select-none hidden dark:block", className)}
        />
      </>
    );
  }

  const v = VARIANTS[variant];
  return (
    <Image
      src={v.src}
      alt={v.alt}
      width={v.width}
      height={v.height}
      priority={priority}
      className={cn("h-auto select-none", className)}
    />
  );
}
