import type { ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl ${strong ? "glass-strong" : "glass"} shadow-glass ${className}`}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "success" | "warning" | "error";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-ink-100 text-ink-600",
    gold: "bg-gold-100 text-gold-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    error: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function SectionTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      {eyebrow && (
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-gold-600">{eyebrow}</div>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-ink-500">{subtitle}</p>}
    </div>
  );
}

export function ProgressBar({ progress, indeterminate = false }: { progress: number; indeterminate?: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
      <div
        className={`h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600 ${
          indeterminate ? "w-1/3 animate-shimmer shimmer-bar" : ""
        }`}
        style={indeterminate ? undefined : { width: `${Math.min(100, Math.max(4, progress))}%`, transition: "width .4s ease" }}
      />
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink-600">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-ink-400">{description}</p>}
    </div>
  );
}
