"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileText,
  Gauge,
  Globe,
  GraduationCap,
  LayoutTemplate,
  ListChecks,
  Mail,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Wand2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppNavBar } from "@/components/AppNavBar";
import { Footer } from "@/components/Footer";
import { Logo } from "@/components/ui/Logo";
import ShinyText from "@/components/ui/ShinyText";

// Showcase strip beneath the hero. Each entry pairs a role with a real company
// logo (self-hosted SVG in /public/logos); the chips auto-scroll as a marquee
// and click through to sign-up. `tint` is the soft brand-tinted ring/glow used
// on hover so each card keeps a hint of the company's colour.
const SHOWCASE = [
  { role: "Senior ML Engineer", company: "Google", logo: "/logos/google.svg", tint: "59,130,246" },
  { role: "Backend Engineer", company: "Stripe", logo: "/logos/stripe.svg", tint: "99,91,255" },
  { role: "Product Designer", company: "Figma", logo: "/logos/figma.svg", tint: "242,78,30" },
  { role: "Data Scientist", company: "Airbnb", logo: "/logos/airbnb.svg", tint: "255,90,95" },
  { role: "Frontend Engineer", company: "Vercel", logo: "/logos/vercel.svg", tint: "15,23,42" },
  { role: "Platform Engineer", company: "Netflix", logo: "/logos/netflix.svg", tint: "229,9,20" },
  { role: "Mobile Engineer", company: "Spotify", logo: "/logos/spotify.svg", tint: "30,215,96" },
  { role: "Product Manager", company: "Notion", logo: "/logos/notion.svg", tint: "15,23,42" },
  { role: "Full-Stack Engineer", company: "Shopify", logo: "/logos/shopify.svg", tint: "95,191,67" },
  { role: "Software Engineer", company: "GitHub", logo: "/logos/github.svg", tint: "15,23,42" },
  { role: "Frontend Engineer", company: "Linear", logo: "/logos/linear.svg", tint: "94,106,210" },
  { role: "Backend Engineer", company: "Coinbase", logo: "/logos/coinbase.svg", tint: "0,82,255" },
];

// Trust strip stats shown under the hero.
const STATS = [
  { value: "60s", label: "From upload to offer-ready PDF" },
  { value: "8+", label: "Specialized AI agents in the pipeline" },
  { value: "ATS", label: "Scored & optimized for the bots" },
  { value: "3", label: "Recruiter-grade resume templates" },
];

// Every shipped capability, grouped as feature cards. Order roughly follows the
// product flow: tailor → review → score → expand into the extra deliverables.
const FEATURES = [
  {
    icon: Wand2,
    title: "Honest resume tailoring",
    desc: "Agents reorder, rewrite, and mirror the job's language only where your real experience backs it up — never inventing skills or metrics.",
    tone: "from-violet-500 to-indigo-500",
  },
  {
    icon: ListChecks,
    title: "Human-in-the-loop review",
    desc: "Every proposed change lands as an accept/deny checklist with before & after snippets. You stay in control of what ships.",
    tone: "from-indigo-500 to-blue-500",
  },
  {
    icon: Gauge,
    title: "ATS scorecard, before & after",
    desc: "See exactly how your resume scores against the role, then watch the number climb after tailoring — with a full keyword breakdown.",
    tone: "from-sky-500 to-cyan-500",
  },
  {
    icon: LayoutTemplate,
    title: "Recruiter-grade templates",
    desc: "Render to Classic, Minimal, or Modern — all single-column and ATS-friendly — then export as a pixel-perfect PDF or editable DOCX.",
    tone: "from-fuchsia-500 to-pink-500",
  },
  {
    icon: Mail,
    title: "Cover letters & outreach email",
    desc: "Generate a matching cover letter and a ready-to-send application email, then fire it off straight from Gmail in one click.",
    tone: "from-rose-500 to-red-500",
  },
  {
    icon: MessageSquareText,
    title: "Interview prep packet",
    desc: "Likely questions, talking points, and tailored answers — generated from your resume and the exact role you're targeting.",
    tone: "from-amber-500 to-orange-500",
  },
  {
    icon: GraduationCap,
    title: "Skill gap & growth roadmap",
    desc: "Spot the skills the role wants that you're missing, with a week-by-week learning plan to close the gap before the interview.",
    tone: "from-emerald-500 to-teal-500",
  },
  {
    icon: UserCheck,
    title: "Recruiter's-eye review",
    desc: "An agent reads your tailored resume like a hiring manager — strengths, red flags, and a blunt hire / no-hire verdict.",
    tone: "from-teal-500 to-green-500",
  },
  {
    icon: ShieldAlert,
    title: "Resume risk detector",
    desc: "Surfaces weak spots — vague bullets, missing metrics, gaps — before a recruiter does, with concrete fixes for each one.",
    tone: "from-orange-500 to-amber-500",
  },
];

// The three-step "how it works" flow.
const STEPS = [
  {
    icon: FileText,
    title: "Drop your resume & the job",
    desc: "Upload your resume and paste a job link — we scrape the posting automatically. Pick a template and you're set.",
  },
  {
    icon: Sparkles,
    title: "Agents tailor & score it",
    desc: "A pipeline of AI agents rewrites, scores against the ATS, and surfaces every change for your approval in real time.",
  },
  {
    icon: Download,
    title: "Download & apply",
    desc: "Grab your offer-ready PDF and DOCX, the cover letter, interview prep, and a send-ready email — all in one place.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [jdUrl, setJdUrl] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = jdUrl.trim();
    router.push(trimmed ? `/home?jd=${encodeURIComponent(trimmed)}` : "/home");
  };

  return (
    <main className="relative flex flex-col overflow-x-hidden px-4 pb-6 sm:px-6 lg:px-8">
      {/* First screen — header + hero + showcase fill exactly one viewport so
          this is all the user sees before scrolling. Everything below the fold
          (stats, features, CTA, footer) flows after this block. */}
      <div className="flex min-h-screen flex-col pb-16 pt-8 sm:pb-20">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <Link href="/" aria-label="ApplyAI home">
            <Logo variant="primary" priority className="h-12 w-auto sm:h-16" />
          </Link>
          <AppNavBar />
        </header>

        <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center py-8 text-center sm:py-16">
        <div className="landing-reveal mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 dark:border-violet-700/40 dark:bg-violet-500/10 dark:text-violet-300">
          <Sparkles className="h-3 w-3" />
          Powered by AI Agents
        </div>

        <h1
          className="landing-reveal text-balance text-[32px] font-bold leading-[1.1] tracking-tight text-slate-900 dark:text-slate-100 sm:text-6xl md:text-7xl"
          style={{ animationDelay: "0.05s" }}
        >
          Tailor a Resume that{" "}
          <span className="relative inline-block sm:whitespace-nowrap">
            <ShinyText
              text="Gets You Hired"
              speed={3}
              spread={100}
              color="#7c3aed"
              shineColor="#e9d5ff"
            />
            <Sparkles
              aria-hidden
              className="absolute -right-4 -top-3 h-6 w-6 text-fuchsia-400 drop-shadow-[0_0_12px_rgba(217,70,239,0.45)] dark:text-fuchsia-300"
            />
            <Sparkles
              aria-hidden
              className="absolute -bottom-2 -left-4 h-4 w-4 text-violet-400 drop-shadow-[0_0_10px_rgba(139,92,246,0.45)] dark:text-violet-300"
            />
          </span>
        </h1>

        <p
          className="landing-reveal mx-auto mt-6 max-w-2xl text-balance text-base text-slate-600 dark:text-slate-400 sm:text-lg"
          style={{ animationDelay: "0.12s" }}
        >
          Drop your resume, point us at a job, and our AI agents rewrite,
          score against the ATS, and hand you an offer-ready PDF in 60 seconds —
          plus a cover letter and application email if you want them.
        </p>

        <form
          onSubmit={onSubmit}
          className="landing-reveal mx-auto mt-10 flex w-full max-w-2xl flex-col items-stretch gap-2 sm:flex-row sm:gap-3"
          style={{ animationDelay: "0.18s" }}
        >
          <div className="relative flex flex-1 items-center rounded-full border border-white/60 bg-white/40 px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_8px_24px_-12px_rgba(15,23,42,0.18)] backdrop-blur-md transition focus-within:border-violet-400 dark:border-white/10 dark:bg-white/[0.06] dark:focus-within:border-violet-500 dark:focus-within:bg-white/[0.1]">
            <Globe className="ml-3 mr-2 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
            <input
              type="url"
              inputMode="url"
              placeholder="Paste a job description URL"
              value={jdUrl}
              onChange={(e) => setJdUrl(e.target.value)}
              aria-label="Job description URL"
              className="h-12 w-full flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-6 font-display text-sm font-semibold tracking-tight text-white shadow-[0_10px_24px_-8px_rgba(99,102,241,0.55)] transition hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98]"
          >
            Tailor resume
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p
          className="landing-reveal mx-auto mt-3 max-w-xl text-xs text-slate-500 dark:text-slate-400"
          style={{ animationDelay: "0.24s" }}
        >
          Don&apos;t have a URL? You can paste the JD itself on the next step.
        </p>
      </section>

      <div
        className="landing-reveal relative mx-auto mt-6 w-full max-w-7xl"
        style={{
          animationDelay: "0.32s",
          maskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        }}
      >
        {/* Duplicated track so the -50% marquee keyframe loops seamlessly. */}
        <ul className="showcase-marquee flex items-center gap-3 py-2 sm:gap-4">
          {[...SHOWCASE, ...SHOWCASE].map((s, i) => (
            <ShowcaseChip key={`${s.company}-${i}`} {...s} />
          ))}
        </ul>
        </div>
      </div>

      {/* ── Trust / stats strip ─────────────────────────────────────────── */}
      <Reveal className="mx-auto mt-20 w-full max-w-5xl">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="glass rounded-2xl px-4 py-5 text-center"
            >
              <dt className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
                {s.value}
              </dt>
              <dd className="mt-2 text-xs leading-snug text-slate-600 dark:text-slate-400">
                {s.label}
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto mt-28 w-full max-w-6xl scroll-mt-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 dark:border-violet-700/40 bg-violet-50 dark:bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">
            <Zap className="h-3 w-3" />
            Everything in one pipeline
          </span>
          <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            More than a resume rewriter
          </h2>
          <p className="mx-auto mt-4 text-balance text-base text-slate-600 dark:text-slate-400">
            One job posting kicks off a whole team of agents — each producing a
            real deliverable that gets you closer to the offer.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} index={i} {...f} />
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="mx-auto mt-28 w-full max-w-5xl scroll-mt-24"
      >
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 dark:border-violet-700/40 bg-violet-50 dark:bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">
            <Sparkles className="h-3 w-3" />
            Three steps, sixty seconds
          </span>
          <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            How it works
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <StepCard key={step.title} index={i} {...step} />
          ))}
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────────────────── */}
      <Reveal className="mx-auto mt-28 w-full max-w-5xl">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 px-6 py-14 text-center shadow-[0_24px_60px_-20px_rgba(99,102,241,0.6)] sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl"
          />
          <h2 className="relative text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Your next application, tailored in a minute
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-balance text-base text-violet-100">
            Stop rewriting the same resume by hand. Let the agents do it — and
            keep the final say.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/home"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-violet-700 shadow-lg transition hover:bg-violet-50 active:scale-[0.98]"
            >
              Tailor my resume
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-7 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
            >
              Create free account
            </Link>
          </div>
          <p className="relative mt-5 flex items-center justify-center gap-1.5 text-xs text-violet-100">
            <CheckCircle2 className="h-3.5 w-3.5" />
            No credit card — sign in with Google and go
          </p>
        </div>
      </Reveal>

      <Footer />
    </main>
  );
}

function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  tone,
  index,
}: {
  icon: typeof Wand2;
  title: string;
  desc: string;
  tone: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay: (index % 3) * 0.06 }}
      className="group glass rounded-3xl p-6 transition hover:-translate-y-1 hover:border-violet-300/70 dark:hover:border-violet-500/40"
    >
      <span
        className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-md`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {desc}
      </p>
    </motion.div>
  );
}

function StepCard({
  icon: Icon,
  title,
  desc,
  index,
}: {
  icon: typeof FileText;
  title: string;
  desc: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay: index * 0.1 }}
      className="relative glass rounded-3xl p-6"
    >
      <span className="absolute right-5 top-5 text-5xl font-bold leading-none text-slate-200/80 dark:text-white/5">
        {index + 1}
      </span>
      <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-md">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {desc}
      </p>
    </motion.div>
  );
}

function ShowcaseChip({
  role,
  company,
  logo,
  tint,
}: {
  role: string;
  company: string;
  logo: string;
  tint: string;
}) {
  return (
    <li className="shrink-0">
      <Link
        href="/signup"
        aria-label={`${role} at ${company} — sign up to tailor your resume`}
        className="group inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-900/70 dark:hover:border-violet-500/50"
        style={{ ["--tint" as string]: tint }}
      >
        {/* White tile keeps brand logos legible in both themes. */}
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 transition group-hover:ring-[rgba(var(--tint),0.5)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt={`${company} logo`}
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
            loading="lazy"
          />
        </span>
        <div className="text-left">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {role}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {company}
          </p>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:text-violet-500 dark:text-slate-500 dark:group-hover:text-violet-400" />
      </Link>
    </li>
  );
}
