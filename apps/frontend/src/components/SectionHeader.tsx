export function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {subtitle && (
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      )}
    </div>
  );
}
