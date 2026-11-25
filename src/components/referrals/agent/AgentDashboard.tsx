"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  CircleHelp,
  HandCoins,
  Megaphone,
  Send,
  UserPlus,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryKeys } from "@/lib/query-keys";
import { useMyReferralDashboard } from "@/hooks/useMyReferralDashboard";
import { SOCIAL } from "@/lib/social";
import { openTelegramUrl } from "@/lib/telegram-webapp";
import { ActivityBars } from "@/components/staff/referrals/referral-ui";
import {
  getMyReferralActivity,
  getMyReferralPayouts,
  type AgentReferralDashboard,
  type ReferralCodeSummary,
} from "@/services/referrals.service";
import { AgentShareCard } from "./AgentShareCard";
import { AgentProgressCard } from "./AgentProgressCard";
import { AgentReferralsList } from "./AgentReferralsList";
import { formatAgentDate } from "./format";

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  i,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  i: number;
}) {
  return (
    <div className="cm-card cm-rise rounded-2xl p-3.5 sm:p-4" style={{ ["--i" as string]: i }}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-1.5 text-xl font-extrabold tabular-nums tracking-tight text-slate-900 sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{hint}</p>}
    </div>
  );
}

function EarningsCard({ summary }: { summary: ReferralCodeSummary }) {
  const { user } = useAuth();
  const { dict, t, formatCurrency } = useLanguage();
  const e = summary.earnings;
  const { data: payouts, isLoading } = useQuery({
    queryKey: queryKeys.me.referralPayouts(user?.id),
    queryFn: getMyReferralPayouts,
    staleTime: 60_000,
  });
  const mine = (payouts ?? []).filter((p) => !p.codeId || p.codeId === summary.code.id);

  return (
    <section className="cm-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
        <Wallet className="h-4 w-4 text-[var(--brand-blue)]" />
        {dict.agent.earningsTitle}
      </h2>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          { label: dict.agent.earned, value: e.earned, cls: "text-slate-900" },
          { label: dict.agent.paidOut, value: e.paidOut, cls: "text-slate-600" },
          { label: dict.agent.owed, value: e.owed, cls: "text-emerald-700" },
        ].map((row) => (
          <div key={row.label} className="rounded-xl bg-slate-50 px-2 py-2.5">
            <dt className="truncate text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{row.label}</dt>
            <dd className={`mt-0.5 text-sm font-extrabold tabular-nums sm:text-base ${row.cls}`}>
              {formatCurrency(row.value)}
            </dd>
          </div>
        ))}
      </dl>
      {e.overpaid > 0 && (
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          {t("agent.overpaid", { amount: formatCurrency(e.overpaid) })}
        </p>
      )}

      <p className="mt-4 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
        {dict.agent.payoutsTitle}
      </p>
      {isLoading ? (
        <div className="mt-2 space-y-2" aria-busy="true">
          <div className="skeleton h-10 w-full rounded-xl" />
          <div className="skeleton h-10 w-full rounded-xl" />
        </div>
      ) : mine.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs font-medium text-slate-500">
          {dict.agent.noPayouts}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {mine.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">{formatAgentDate(p.paidAt)}</p>
                {(p.method || p.reference) && (
                  <p className="truncate text-xs font-medium capitalize text-slate-500">
                    {[p.method, p.reference].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-sm font-extrabold tabular-nums text-emerald-700">
                {formatCurrency(p.amount)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityCard({ codeId, single }: { codeId: string; single: boolean }) {
  const { user } = useAuth();
  const { dict } = useLanguage();
  const scope = single ? undefined : codeId;
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.me.referralActivity(user?.id, scope),
    queryFn: () => getMyReferralActivity({ days: 30, codeId: scope }),
    staleTime: 60_000,
  });
  const empty = !!data && data.every((d) => !d.visitors && !d.signups && !d.qualified);
  return (
    <section className="cm-card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
        <Activity className="h-4 w-4 text-[var(--brand-blue)]" />
        {dict.agent.activityTitle}
      </h2>
      {isLoading ? (
        <div className="skeleton h-44 w-full rounded-xl" aria-busy="true" />
      ) : empty || !data ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-semibold text-slate-500">
          {dict.agent.noActivity}
        </p>
      ) : (
        <ActivityBars
          days={data}
          labels={{
            visitors: dict.agent.visitors,
            signups: dict.agent.signups,
            qualified: dict.agent.qualified,
            empty: dict.agent.noActivity,
          }}
        />
      )}
    </section>
  );
}

function RulesCard({ summary }: { summary: ReferralCodeSummary }) {
  const { dict, t } = useLanguage();
  const auctions = summary.program.qualifyingAuctions ?? [];
  const rules = [
    dict.agent.ruleSignup,
    t("agent.ruleTicket", { days: summary.program.attributionWindowDays }),
    dict.agent.ruleOnce,
    ...(auctions.length ? [t("agent.ruleAuctions", { list: auctions.map((a) => a.title).join(", ") })] : []),
  ];
  return (
    <section className="cm-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
        <CircleHelp className="h-4 w-4 text-[var(--brand-blue)]" />
        {dict.agent.rulesTitle}
      </h2>
      <ol className="mt-3 space-y-2.5">
        {rules.map((rule, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-slate-600">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[11px] font-extrabold text-[var(--color-primary-800)]">
              {i + 1}
            </span>
            <span className="leading-snug">{rule}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function LoadingState() {
  return (
    <div aria-busy="true" className="space-y-4">
      <div className="skeleton h-48 w-full rounded-[1.25rem] lg:h-40" />
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="cm-card space-y-2 rounded-2xl p-4">
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton h-6 w-2/3" />
            <div className="skeleton h-3 w-3/4" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="skeleton h-80 rounded-[1.25rem] lg:col-span-2" />
        <div className="skeleton h-80 rounded-[1.25rem]" />
      </div>
    </div>
  );
}

function NotAgentState() {
  const { dict } = useLanguage();
  return (
    <div className="cm-card mx-auto flex max-w-xl flex-col items-center px-6 py-10 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-yellow)] text-slate-900">
        <Megaphone className="h-6 w-6" />
      </span>
      <p className="text-lg font-extrabold text-slate-900">{dict.agent.notAgentTitle}</p>
      <p className="mt-1 text-sm text-slate-600">{dict.agent.notAgentDesc}</p>
      <button
        type="button"
        onClick={() => openTelegramUrl(SOCIAL.telegram)}
        className="btn-shine mt-5 inline-flex h-10 items-center gap-1.5 rounded-xl bg-[var(--brand-blue)] px-4 text-sm font-extrabold text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-px"
      >
        <Send className="h-4 w-4" />
        {dict.agent.contactTeam}
      </button>
    </div>
  );
}

function Dashboard({ data }: { data: AgentReferralDashboard }) {
  const { dict, t, formatCurrency } = useLanguage();
  const [codeId, setCodeId] = useState(data.codes[0]?.code.id);
  const summary = data.codes.find((c) => c.code.id === codeId) ?? data.codes[0];
  if (!summary) return <NotAgentState />;
  const { funnel, earnings } = summary;

  return (
    <div className="space-y-4">
      {data.codes.length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label={dict.agent.codeLabel}>
          {data.codes.map((c) => (
            <button
              key={c.code.id}
              type="button"
              role="tab"
              aria-selected={c.code.id === summary.code.id}
              onClick={() => setCodeId(c.code.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 font-mono text-sm font-extrabold tracking-wider transition ${
                c.code.id === summary.code.id
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {c.code.code}
              {c.code.label ? <span className="ml-1.5 font-sans text-xs font-semibold opacity-70">{c.code.label}</span> : null}
            </button>
          ))}
        </div>
      )}

      <AgentShareCard code={summary.code} />

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat
          i={0}
          label={dict.agent.statSignups}
          value={String(funnel.signups)}
          hint={t("agent.statSignupsHint", { visitors: funnel.visitors })}
          icon={UserPlus}
          accent="bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
        />
        <Stat
          i={1}
          label={dict.agent.statQualified}
          value={String(funnel.qualified)}
          hint={t("agent.statQualifiedHint", { pending: funnel.pending })}
          icon={BadgeCheck}
          accent="bg-emerald-50 text-emerald-700"
        />
        <Stat
          i={2}
          label={dict.agent.statEarned}
          value={formatCurrency(earnings.earned)}
          hint={t("agent.statEarnedHint", { amount: formatCurrency(earnings.paidOut) })}
          icon={HandCoins}
          accent="bg-amber-50 text-amber-700"
        />
        <Stat
          i={3}
          label={dict.agent.statOwed}
          value={formatCurrency(earnings.owed)}
          hint={dict.agent.statOwedHint}
          icon={Wallet}
          accent="bg-slate-100 text-slate-700"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <AgentProgressCard summary={summary} />
          <ActivityCard codeId={summary.code.id} single={data.codes.length === 1} />
          <AgentReferralsList
            key={summary.code.id}
            codeId={data.codes.length > 1 ? summary.code.id : undefined}
            total={funnel.signups + funnel.rejected}
          />
        </div>
        <div className="space-y-4">
          <EarningsCard summary={summary} />
          <RulesCard summary={summary} />
        </div>
      </div>
    </div>
  );
}

export function AgentDashboard() {
  const { dict } = useLanguage();
  const { data, isLoading, error, refetch, isRefetching } = useMyReferralDashboard();

  return (
    <div className="pb-12 pt-20 sm:pt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-4 sm:mb-5">
          <p className="cm-eyebrow">{dict.agent.eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {dict.agent.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{dict.agent.subtitle}</p>
        </header>

        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-800">
            {dict.agent.loadError}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="ml-2 underline underline-offset-2 disabled:opacity-60"
            >
              {dict.common.retry}
            </button>
          </div>
        ) : !data?.isReferrer || data.codes.length === 0 ? (
          <NotAgentState />
        ) : (
          <Dashboard data={data} />
        )}
      </div>
    </div>
  );
}
