"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CircleAlert,
  HandCoins,
  Link2,
  Megaphone,
  Phone,
  Send,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryKeys } from "@/lib/query-keys";
import { ApiError, getErrorMessage } from "@/lib/api";
import { stepRangeLabel } from "@/lib/agent-dashboard";
import { SOCIAL } from "@/lib/social";
import { openTelegramUrl } from "@/lib/telegram-webapp";
import { sendOtp, verifyOtp } from "@/services/auth.service";
import {
  getAgentJoinInfo,
  getPublicAgentProgram,
  joinAsAgent,
  type AgentJoinInfo,
  type ReferralProgram,
} from "@/services/referrals.service";
import { PhonePrefixInput } from "@/components/auth/PhonePrefixInput";
import { Input } from "@/components/ui/input";

const primaryBtn =
  "btn-shine inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand-blue)] px-5 text-sm font-extrabold text-white shadow-[var(--shadow-glow)] transition hover:-translate-y-px disabled:pointer-events-none disabled:opacity-50";
const secondaryBtn =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 text-sm font-extrabold text-slate-900 transition hover:-translate-y-px hover:border-slate-300";

function topRate(program: ReferralProgram): number {
  return program.tiers.reduce((max, t) => Math.max(max, t.amount), 0);
}

/** Hero, three steps and the payout deal. Shared by visitors and signed-in customers. */
function AgentPitch({ program, children }: { program?: ReferralProgram; children?: React.ReactNode }) {
  const { dict, t, formatCurrency } = useLanguage();
  const top = program ? topRate(program) : 0;
  const steps = [
    { icon: Link2, title: dict.agent.joinStep1Title, desc: dict.agent.joinStep1Desc },
    {
      icon: UserPlus,
      title: dict.agent.joinStep2Title,
      desc: t("agent.joinStep2Desc", { days: program?.attributionWindowDays ?? 30 }),
    },
    {
      icon: HandCoins,
      title: dict.agent.joinStep3Title,
      desc:
        program && program.threshold > 0
          ? t("agent.joinStep3Desc", { threshold: program.threshold })
          : dict.agent.joinStep3DescNow,
    },
  ];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <section className="cm-card cm-rise relative overflow-hidden p-5 sm:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--brand-yellow)] opacity-30 blur-3xl"
          />
          <span className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-yellow)] text-slate-900">
            <Megaphone className="h-6 w-6" />
          </span>
          <h2 className="relative text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {dict.agent.joinTitle}
          </h2>
          <p className="relative mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
            {dict.agent.joinDesc}
          </p>
          {top > 0 && (
            <p className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-extrabold text-emerald-800 ring-1 ring-emerald-200">
              <HandCoins className="h-4 w-4" />
              {t("agent.joinUpTo", { amount: formatCurrency(top) })}
            </p>
          )}
          {children && <div className="relative mt-6">{children}</div>}
        </section>

        <ol className="grid gap-2.5 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="cm-card cm-rise rounded-2xl p-4"
              style={{ ["--i" as string]: i + 1 }}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                  <s.icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  {i + 1}
                </span>
              </div>
              <p className="mt-2 text-sm font-extrabold text-slate-900">{s.title}</p>
              <p className="mt-0.5 text-xs leading-snug text-slate-600">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-4 lg:col-span-2">
        {program && <DealCard program={program} />}
        <RulesList />
      </div>
    </div>
  );
}

function DealCard({ program }: { program: ReferralProgram }) {
  const { dict, t, formatCurrency } = useLanguage();
  const rows = [
    ...(program.threshold > 0
      ? [{ range: stepRangeLabel({ from: 1, to: program.threshold }), value: dict.agent.joinDealUnlock, unlock: true }]
      : []),
    ...program.tiers.map((tier) => ({
      range: stepRangeLabel({ from: tier.from, to: tier.to ?? null }),
      value: t("agent.ladderPerBidder", { amount: formatCurrency(tier.amount) }),
      unlock: false,
    })),
  ];
  return (
    <section className="cm-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
        <HandCoins className="h-4 w-4 text-[var(--brand-blue)]" />
        {dict.agent.joinDealTitle}
      </h2>
      <ul className="mt-3 divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.range} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm font-semibold text-slate-600">
              {t("agent.ladderTierDesc", { range: r.range })}
            </span>
            <span
              className={`shrink-0 text-sm font-extrabold tabular-nums ${
                r.unlock ? "text-slate-500" : "text-emerald-700"
              }`}
            >
              {r.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RulesList() {
  const { dict } = useLanguage();
  const rules = [dict.agent.joinRule1, dict.agent.joinRule2, dict.agent.joinRule3, dict.agent.joinRule4];
  return (
    <section className="cm-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
        <ShieldCheck className="h-4 w-4 text-[var(--brand-blue)]" />
        {dict.agent.joinRulesTitle}
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

function ContactTeamButton() {
  const { dict } = useLanguage();
  return (
    <button type="button" onClick={() => openTelegramUrl(SOCIAL.telegram)} className={primaryBtn}>
      <Send className="h-4 w-4" />
      {dict.agent.contactTeam}
    </button>
  );
}

/** Why this account can't join right now, with the way forward. */
function BlockedNotice({ reason }: { reason: string }) {
  const { dict } = useLanguage();
  const copy: Record<string, [string, string]> = {
    signup_closed: [dict.agent.joinClosedTitle, dict.agent.joinClosedDesc],
    phone_taken: [dict.agent.joinPhoneTakenTitle, dict.agent.joinPhoneTakenDesc],
    not_participant: [dict.agent.joinNotAllowedTitle, dict.agent.joinNotAllowedDesc],
    account_inactive: [dict.agent.joinInactiveTitle, dict.agent.joinInactiveDesc],
  };
  const [title, desc] = copy[reason] ?? [dict.agent.joinError, ""];
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-center gap-2 text-sm font-extrabold text-amber-950">
        <CircleAlert className="h-4 w-4 shrink-0" />
        {title}
      </p>
      {desc && <p className="mt-1 text-sm text-amber-900">{desc}</p>}
      {reason !== "not_participant" && (
        <div className="mt-3">
          <ContactTeamButton />
        </div>
      )}
    </div>
  );
}

type PhoneStep = "enter" | "code" | "verified";

/** The join form: phone (verified by SMS when the account has none), the rules, one button. */
function JoinForm({ info }: { info: AgentJoinInfo }) {
  const { user } = useAuth();
  const { dict } = useLanguage();
  const queryClient = useQueryClient();
  const needsPhone = !info.hasPhone;
  const [accepted, setAccepted] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("enter");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendCode = useMutation({
    mutationFn: () => sendOtp(phone.trim()),
    onSuccess: () => {
      setError(null);
      setCode("");
      setPhoneStep("code");
    },
    onError: (err) => setError(getErrorMessage(err)),
  });
  const checkCode = useMutation({
    mutationFn: () => verifyOtp(phone.trim(), code.trim()),
    onSuccess: (res) => {
      setError(null);
      setToken(res.verificationToken);
      setPhoneStep("verified");
    },
    onError: (err) => setError(getErrorMessage(err)),
  });
  const join = useMutation({
    mutationFn: () =>
      joinAsAgent({
        acceptTerms: true,
        ...(needsPhone && token ? { phone: phone.trim(), verificationToken: token } : {}),
      }),
    onSuccess: (dashboard) => {
      queryClient.setQueryData(queryKeys.me.referrals(user?.id), dashboard);
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.agentJoin(user?.id) });
      toast.success(dict.agent.joinSuccess);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? getErrorMessage(err) : dict.agent.joinError);
      void queryClient.invalidateQueries({ queryKey: queryKeys.me.agentJoin(user?.id) });
    },
  });

  const phoneReady = !needsPhone || (phoneStep === "verified" && !!token);
  const busy = sendCode.isPending || checkCode.isPending || join.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (accepted && phoneReady) join.mutate();
      }}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4 sm:p-5"
    >
      {needsPhone ? (
        <div>
          <p className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
            <Phone className="h-4 w-4 text-[var(--brand-blue)]" />
            {dict.agent.joinPhoneNeededTitle}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">{dict.agent.joinPhoneNeededDesc}</p>
          {phoneStep === "verified" ? (
            <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
              <BadgeCheck className="h-4 w-4" />
              {dict.agent.joinPhoneVerified} · {phone}
            </p>
          ) : phoneStep === "code" ? (
            <div className="mt-3 space-y-2">
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {dict.auth.codeSentTo} <span className="font-semibold text-slate-900">{phone}</span>
                <button
                  type="button"
                  onClick={() => setPhoneStep("enter")}
                  className="ml-2 font-semibold text-[var(--brand-blue)] underline-offset-2 hover:underline"
                >
                  {dict.auth.changeNumber}
                </button>
              </p>
              <label htmlFor="agent-otp" className="block text-sm font-semibold text-slate-800">
                {dict.auth.verificationCode}
              </label>
              <div className="flex gap-2">
                <Input
                  id="agent-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-lg tracking-[0.35em]"
                  placeholder="••••••"
                />
                <button
                  type="button"
                  disabled={code.length !== 6 || busy}
                  onClick={() => checkCode.mutate()}
                  className={`${secondaryBtn} shrink-0`}
                >
                  {dict.agent.joinVerifyCode}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <PhonePrefixInput id="agent-phone" value={phone} onChange={setPhone} />
              <button
                type="button"
                disabled={!phone.trim() || busy}
                onClick={() => sendCode.mutate()}
                className={`${secondaryBtn} w-full`}
              >
                {sendCode.isPending ? dict.auth.sendingCode : dict.auth.sendVerificationCode}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              {dict.agent.joinPhoneLabel}
            </p>
            <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">{info.phone}</p>
          </div>
          <p className="max-w-[12rem] text-right text-xs text-slate-500">{dict.agent.joinPhoneHint}</p>
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-slate-300"
          style={{ accentColor: "var(--brand-blue)" }}
        />
        <span className="text-sm font-semibold text-slate-800">{dict.agent.joinAccept}</span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}

      <button type="submit" disabled={!accepted || !phoneReady || busy} className={`${primaryBtn} w-full`}>
        <Megaphone className="h-4 w-4" />
        {join.isPending ? dict.agent.joining : dict.agent.joinBtn}
      </button>
    </form>
  );
}

function PitchSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4 lg:grid-cols-5">
      <div className="skeleton h-96 rounded-[1.25rem] lg:col-span-3" />
      <div className="skeleton h-96 rounded-[1.25rem] lg:col-span-2" />
    </div>
  );
}

/** /agent for a signed-in customer who isn't an agent yet. */
export function BecomeAgent() {
  const { user } = useAuth();
  const { dict } = useLanguage();
  const { data: info, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.me.agentJoin(user?.id),
    queryFn: getAgentJoinInfo,
    enabled: !!user,
    staleTime: 30_000,
  });

  if (isLoading) return <PitchSkeleton />;
  if (error || !info) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-800">
        {dict.agent.loadError}
        <button type="button" onClick={() => refetch()} className="ml-2 underline underline-offset-2">
          {dict.common.retry}
        </button>
      </div>
    );
  }

  const blocked = info.reason && info.reason !== "needs_phone" ? info.reason : null;
  return (
    <AgentPitch program={info.program}>
      {blocked ? <BlockedNotice reason={blocked} /> : <JoinForm info={info} />}
    </AgentPitch>
  );
}

/** /agent for a visitor who isn't signed in: the deal, then sign up or sign in. */
export function AgentGuestPitch() {
  const { dict } = useLanguage();
  const { data } = useQuery({
    queryKey: [...queryKeys.all, "public", "agent-program"],
    queryFn: getPublicAgentProgram,
    staleTime: 5 * 60_000,
  });
  return (
    <AgentPitch program={data?.program}>
      {data && !data.open ? (
        <BlockedNotice reason="signup_closed" />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/signup?agent=1&redirect=%2Fagent" className={primaryBtn}>
              <Megaphone className="h-4 w-4" />
              {dict.agent.joinGuestSignup}
            </Link>
            <Link href="/login?redirect=%2Fagent" className={secondaryBtn}>
              {dict.agent.joinGuestLogin}
            </Link>
          </div>
          <p className="text-xs text-slate-500">{dict.agent.joinGuestHint}</p>
        </div>
      )}
    </AgentPitch>
  );
}
