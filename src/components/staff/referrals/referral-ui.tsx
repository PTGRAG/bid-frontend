"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { toast } from "sonner";
import type { ReferralDailyCount } from "@/services/referrals.service";

export function formatEtb(n: number | null | undefined, digits = 0): string {
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export function formatCount(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(n || 0);
}

/** Formats a percentage already on a 0–100 scale (the backend's funnel rates). */
export function formatPct(pct: number | null | undefined): string {
  if (!pct) return "0%";
  return `${pct < 10 ? Number(pct.toFixed(1)) : Math.round(pct)}%`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function SectionHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{eyebrow}</p>
        <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warn" | "danger" | "ok" | "brand";
}) {
  const toneCls =
    tone === "warn"
      ? "border-amber-200 bg-amber-50/80"
      : tone === "danger"
        ? "border-red-200 bg-red-50/80"
        : tone === "ok"
          ? "border-emerald-200 bg-emerald-50/70"
          : tone === "brand"
            ? "border-[var(--brand-blue)]/25 bg-[var(--brand-blue)]/[0.04]"
            : "border-slate-200 bg-white";
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneCls}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export const CODE_STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-800 border-emerald-200",
  paused: "bg-slate-100 text-slate-600 border-slate-200",
};

export const REFERRAL_STATUS_BADGE: Record<string, string> = {
  signed_up: "bg-sky-50 text-sky-800 border-sky-200",
  qualified: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-slate-100 text-slate-600 border-slate-200",
};

export const REFERRAL_STATUS_LABEL: Record<string, string> = {
  signed_up: "Signed up",
  qualified: "Qualified",
  rejected: "Rejected",
  expired: "Expired",
};

export function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${className}`}>
      {children}
    </span>
  );
}

/** Marks agents who signed themselves up from the app (no staff step). */
export function SelfSignupBadge() {
  return (
    <Badge className="border-amber-200 bg-amber-50 text-amber-800">
      <span title="Became an agent from the app">self signup</span>
    </Badge>
  );
}

export function KindBadge({ kind }: { kind: string }) {
  return (
    <Badge
      className={
        kind === "influencer"
          ? "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800"
          : "border-[var(--brand-blue)]/30 bg-[var(--brand-blue)]/[0.06] text-[var(--brand-blue)]"
      }
    >
      {kind}
    </Badge>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true);
            toast.success("Copied");
            window.setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => toast.error("Could not copy"));
      }}
      className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      title={value}
      aria-label={`${label}: ${value}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

/** Progress toward the payout threshold. */
export function ThresholdBar({
  qualified,
  threshold,
  compact = false,
}: {
  qualified: number;
  threshold: number;
  compact?: boolean;
}) {
  const unlocked = qualified >= threshold;
  const pct = threshold <= 0 ? 100 : Math.min(100, (qualified / threshold) * 100);
  return (
    <div className={compact ? "w-28" : "w-full"}>
      <div className={`overflow-hidden rounded-full bg-slate-100 ${compact ? "h-1.5" : "h-2.5"}`}>
        <div
          className={`h-full rounded-full transition-all ${unlocked ? "bg-emerald-500" : "bg-[var(--brand-blue)]"}`}
          style={{ width: `${Math.max(pct, qualified > 0 ? 4 : 0)}%` }}
        />
      </div>
      <p className={`mt-1 font-semibold ${compact ? "text-[10px]" : "text-xs"} ${unlocked ? "text-emerald-700" : "text-slate-500"}`}>
        {unlocked
          ? `Unlocked · ${formatCount(qualified)} qualified`
          : `${formatCount(qualified)} / ${formatCount(threshold)} to unlock`}
      </p>
    </div>
  );
}

/** Daily visitors, signups and qualified bidders as grouped bars. */
export function ActivityBars({
  days,
  labels = { visitors: "Visitors", signups: "Signups", qualified: "Qualified", empty: "No activity yet" },
}: {
  days: ReferralDailyCount[];
  labels?: { visitors: string; signups: string; qualified: string; empty: string };
}) {
  if (!days.length) {
    return <p className="py-10 text-center text-sm text-slate-400">{labels.empty}</p>;
  }
  const max = Math.max(1, ...days.map((d) => Math.max(d.visitors, d.signups, d.qualified)));
  const totals = days.reduce(
    (acc, d) => ({
      visitors: acc.visitors + d.visitors,
      signups: acc.signups + d.signups,
      qualified: acc.qualified + d.qualified,
    }),
    { visitors: 0, signups: 0, qualified: 0 }
  );
  const series = [
    { key: "visitors", label: labels.visitors, cls: "bg-slate-300", total: totals.visitors },
    { key: "signups", label: labels.signups, cls: "bg-[var(--brand-blue)]", total: totals.signups },
    { key: "qualified", label: labels.qualified, cls: "bg-emerald-500", total: totals.qualified },
  ] as const;
  const labelEvery = Math.max(1, Math.ceil(days.length / 6));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <span className={`h-2.5 w-2.5 rounded-sm ${s.cls}`} />
            {s.label}
            <span className="font-extrabold text-slate-900">{formatCount(s.total)}</span>
          </div>
        ))}
      </div>
      <div className="flex h-40 gap-[3px]">
        {days.map((d, i) => (
          <div
            key={d.day}
            className="flex h-full min-w-0 flex-1 flex-col items-center"
            title={`${d.day}: ${d.visitors} visitors, ${d.signups} signups, ${d.qualified} qualified`}
          >
            <div className="flex min-h-0 w-full flex-1 items-end justify-center gap-px">
              {series.map((s) => (
                <div
                  key={s.key}
                  className={`w-full max-w-[8px] rounded-t-sm ${s.cls}`}
                  style={{ height: d[s.key] ? `${Math.max(3, (d[s.key] / max) * 100)}%` : "0%" }}
                />
              ))}
            </div>
            <span className="mt-1 h-3 whitespace-nowrap text-[9px] font-semibold text-slate-400">
              {i % labelEvery === 0 ? d.day.slice(5) : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Modal({
  eyebrow,
  title,
  onClose,
  children,
  wide = false,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl ${
          wide ? "max-w-2xl" : "max-w-md"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-blue)]">{eyebrow}</p>
            <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-800">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const selectClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800";

export function pillClass(active: boolean): string {
  return `rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
    active
      ? "bg-[var(--brand-blue)] text-white"
      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
  }`;
}
