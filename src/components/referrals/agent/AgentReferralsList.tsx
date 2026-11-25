"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { UserPlus, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryKeys } from "@/lib/query-keys";
import { SimplePagination } from "@/components/ui/pagination";
import { getMyReferrals, type ReferralView } from "@/services/referrals.service";
import { formatAgentDate } from "./format";

const PAGE_SIZE = 10;
type Filter = "" | "signed_up" | "qualified" | "rejected";

const BADGE: Record<string, string> = {
  signed_up: "border-sky-200 bg-sky-50 text-sky-800",
  qualified: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-red-200 bg-red-50 text-red-700",
  expired: "border-slate-200 bg-slate-100 text-slate-600",
};

function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

function ReferralRow({ r }: { r: ReferralView }) {
  const { dict, t } = useLanguage();
  const a = dict.agent;
  const statusKey = r.status === "signed_up" && r.expired ? "expired" : r.status;
  const statusLabel =
    statusKey === "qualified"
      ? a.statusQualified
      : statusKey === "rejected"
        ? a.statusRejected
        : statusKey === "expired"
          ? a.statusExpired
          : a.statusSignedUp;
  const rejectLabel: Record<string, string> = {
    self_referral: a.rejectSelf,
    duplicate_phone: a.rejectPhone,
    duplicate_payment_account: a.rejectPaymentAccount,
    rejected_by_staff: a.rejectStaff,
  };

  const details: string[] = [];
  if (r.status === "qualified") {
    if (r.qualifiedAt) details.push(t("agent.qualifiedOn", { date: formatAgentDate(r.qualifiedAt) }));
    if (r.auctionTitle) details.push(t("agent.firstTicket", { title: r.auctionTitle }));
  } else if (r.status === "rejected") {
    if (r.rejectReason) details.push(rejectLabel[r.rejectReason] ?? r.rejectReason);
  } else if (r.expired) {
    details.push(a.expiredDesc);
  } else {
    if (r.qualifiesBy) details.push(t("agent.qualifiesBy", { date: formatAgentDate(r.qualifiesBy) }));
    if (r.needsPhone) details.push(a.needsPhone);
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
          r.status === "qualified"
            ? "bg-emerald-100 text-emerald-800"
            : "bg-[var(--color-primary-50)] text-[var(--color-primary-800)]"
        }`}
        aria-hidden
      >
        {initials(r.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate font-extrabold text-slate-900">{r.name || "—"}</span>
          {r.phone && <span className="text-xs font-semibold tabular-nums text-slate-400">{r.phone}</span>}
        </p>
        <p className="text-xs font-medium text-slate-500">
          {t("agent.joinedOn", { date: formatAgentDate(r.signedUpAt) })}
          {details.length > 0 && <span> · {details.join(" · ")}</span>}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${BADGE[statusKey]}`}
      >
        {statusLabel}
      </span>
    </li>
  );
}

/** Paged list of people who signed up with the agent's code, filterable by status. */
export function AgentReferralsList({ codeId, total }: { codeId?: string; total: number }) {
  const { user } = useAuth();
  const { dict } = useLanguage();
  const [filter, setFilter] = useState<Filter>("");
  const [page, setPage] = useState(1);
  const params = { codeId, status: filter || undefined, page, limit: PAGE_SIZE };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: queryKeys.me.referralList(user?.id, params),
    queryFn: () => getMyReferrals(params),
    placeholderData: keepPreviousData,
    enabled: total > 0,
  });

  const filters: { key: Filter; label: string }[] = [
    { key: "", label: dict.agent.filterAll },
    { key: "signed_up", label: dict.agent.filterPending },
    { key: "qualified", label: dict.agent.filterQualified },
    { key: "rejected", label: dict.agent.filterRejected },
  ];
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.limit || PAGE_SIZE))) : 1;

  return (
    <section className="cm-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
          <Users className="h-4 w-4 text-[var(--brand-blue)]" />
          {dict.agent.referralsTitle}
        </h2>
        {total > 0 && (
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5" role="tablist">
            {filters.map((f) => (
              <button
                key={f.key || "all"}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => {
                  setFilter(f.key);
                  setPage(1);
                }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
                  filter === f.key
                    ? "bg-[var(--brand-blue)] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center px-4 py-8 text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-yellow)] text-slate-900">
            <UserPlus className="h-5 w-5" />
          </span>
          <p className="text-sm font-semibold text-slate-600">{dict.agent.noReferrals}</p>
        </div>
      ) : isLoading ? (
        <ul className="mt-2 divide-y divide-slate-100" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 py-3">
              <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3.5 w-1/3" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            </li>
          ))}
        </ul>
      ) : error ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-center text-sm font-semibold text-red-800">
          {dict.agent.loadError}{" "}
          <button type="button" onClick={() => refetch()} className="underline underline-offset-2">
            {dict.common.retry}
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm font-semibold text-slate-500">{dict.agent.noReferralsFiltered}</p>
      ) : (
        <ul className={`mt-1 divide-y divide-slate-100 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
          {items.map((r) => (
            <ReferralRow key={r.id} r={r} />
          ))}
        </ul>
      )}

      <SimplePagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        className="mt-3"
      />
    </section>
  );
}
