"use client";

import { Check, Lock, Trophy, TrendingUp, Unlock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { payoutLadder, stepRangeLabel, thresholdPercent } from "@/lib/agent-dashboard";
import type { ReferralCodeSummary } from "@/services/referrals.service";

/** Threshold progress, the rate the next bidder earns, and the full tier ladder. */
export function AgentProgressCard({ summary }: { summary: ReferralCodeSummary }) {
  const { dict, t, formatCurrency } = useLanguage();
  const { program, earnings } = summary;
  const pct = thresholdPercent(earnings.qualified, earnings.threshold);
  const ladder = payoutLadder(program.threshold, program.tiers, earnings);
  const firstPaid = ladder.find((s) => !s.isUnlock);

  let nextLine: string | null = null;
  if (earnings.nextTier) {
    const n = earnings.nextTier.biddersNeeded;
    const amount = formatCurrency(earnings.nextTier.amount);
    nextLine = n === 1 ? t("agent.nextTierOne", { amount }) : t("agent.nextTier", { count: n, amount });
  } else if (earnings.unlocked && earnings.currentRate > 0) {
    nextLine = dict.agent.topTier;
  }

  return (
    <section className="cm-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
            {dict.agent.progressTitle}
          </p>
          <h2 className="mt-0.5 text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
            {earnings.unlocked
              ? dict.agent.progressUnlocked
              : earnings.remaining === 1
                ? dict.agent.progressLockedOne
                : t("agent.progressLocked", { count: earnings.remaining })}
          </h2>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            earnings.unlocked ? "bg-emerald-100 text-emerald-700" : "bg-[var(--brand-yellow)] text-slate-900"
          }`}
          aria-hidden
        >
          {earnings.unlocked ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
        </span>
      </div>

      <div className="mt-4">
        <div
          className="h-3 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={earnings.threshold}
          aria-valuenow={Math.min(earnings.qualified, earnings.threshold)}
          aria-label={dict.agent.progressTitle}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${
              earnings.unlocked
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-primary-700)]"
            }`}
            style={{ width: `${Math.max(pct, earnings.qualified > 0 ? 3 : 0)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs font-bold tabular-nums text-slate-500">
          {t("agent.progressOf", { qualified: earnings.qualified, threshold: earnings.threshold })}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl bg-[var(--color-primary-50)] px-3.5 py-3">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-primary-800)]">
            {dict.agent.nextBidderEarns}
          </p>
          {earnings.currentRate > 0 ? (
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-[var(--color-primary-800)]">
              {formatCurrency(earnings.currentRate)}
            </p>
          ) : (
            <p className="mt-1 text-sm font-extrabold text-[var(--color-primary-800)]">
              {firstPaid ? t("agent.nextBidderLocked", { from: firstPaid.from }) : "—"}
            </p>
          )}
        </div>
        {nextLine && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 px-3.5 py-3">
            {earnings.nextTier ? (
              <TrendingUp className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <Trophy className="h-5 w-5 shrink-0 text-amber-500" />
            )}
            <p className="text-sm font-bold text-slate-700">{nextLine}</p>
          </div>
        )}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
          {dict.agent.ladderTitle}
        </p>
        <ol className="space-y-1.5">
          {ladder.map((step) => {
            const range = stepRangeLabel(step);
            const current = step.state === "current";
            const done = step.state === "done";
            return (
              <li
                key={step.from}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                  current
                    ? "bg-white ring-2 ring-[var(--brand-blue)]"
                    : done
                      ? "bg-emerald-50/70"
                      : "bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                    done
                      ? "bg-emerald-500 text-white"
                      : current
                        ? "bg-[var(--brand-blue)] text-white"
                        : "bg-white text-slate-400 ring-1 ring-slate-200"
                  }`}
                  aria-hidden
                >
                  {done ? <Check className="h-4 w-4" /> : step.isUnlock ? <Lock className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm font-extrabold text-slate-900">
                    {step.isUnlock ? dict.agent.ladderUnlock : t("agent.ladderPerBidder", { amount: formatCurrency(step.amount) })}
                    {current && (
                      <span className="rounded-full bg-[var(--brand-yellow)] px-1.5 py-px text-[10px] font-extrabold uppercase tracking-wider text-slate-900">
                        {dict.agent.ladderCurrent}
                      </span>
                    )}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    {step.isUnlock
                      ? t("agent.ladderUnlockDesc", { range })
                      : t("agent.ladderTierDesc", { range })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {step.bidders > 0 && (
                    <p className="text-xs font-bold tabular-nums text-slate-500">
                      {t("agent.ladderBidders", { count: step.bidders })}
                    </p>
                  )}
                  {!step.isUnlock && step.subtotal > 0 && (
                    <p className="text-sm font-extrabold tabular-nums text-emerald-700">
                      {formatCurrency(step.subtotal)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
