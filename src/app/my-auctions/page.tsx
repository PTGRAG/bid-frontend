"use client";

import Link from "next/link";
import { ArrowRight, Gavel } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { queryKeys } from "@/lib/query-keys";
import { listMyParticipations } from "@/services/auctions.service";
import { auctionCoverImage } from "@/lib/auction-media";
import type { Auction } from "@/services/auctions.service";

type Dict = ReturnType<typeof useLanguage>["dict"];

/** The viewer's own outcome as a short badge (pay only if you win). */
function resultBadge(
  auction: Auction,
  dict: Dict,
  t: ReturnType<typeof useLanguage>["t"]
): { label: string; sub?: string; className: string } | null {
  const my = auction.myResult;
  if (!my) return null;
  switch (my.outcome) {
    case "won_pay_now": {
      let sub: string | undefined;
      if (my.dueAt) {
        const d = new Date(my.dueAt);
        if (!Number.isNaN(d.getTime())) {
          sub = t("dashboard.resultPayBy", {
            date: d.toLocaleString("en-GB", {
              timeZone: "Africa/Addis_Ababa",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
        }
      }
      return {
        label: dict.dashboard.resultPayNow,
        sub,
        className: "border-amber-300 bg-amber-50 text-amber-900",
      };
    }
    case "won_paid":
      return { label: dict.dashboard.resultWonPaid, className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
    case "won_expired":
      return { label: dict.dashboard.resultWonExpired, className: "border-slate-200 bg-slate-50 text-slate-600" };
    case "lost":
      return { label: dict.dashboard.resultLost, className: "border-slate-200 bg-slate-50 text-slate-600" };
    case "no_winner":
      return { label: dict.dashboard.resultNoWinner, className: "border-slate-200 bg-slate-50 text-slate-600" };
    case "cancelled":
      return { label: dict.dashboard.resultCancelled, className: "border-slate-200 bg-slate-50 text-slate-600" };
    case "pending":
      return { label: dict.dashboard.resultPending, className: "border-sky-200 bg-sky-50 text-sky-800" };
  }
  return null;
}

function MyAuctionsContent() {
  const { dict, t } = useLanguage();
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.me.auctions({ page: 1, limit: 50 }),
    queryFn: () => listMyParticipations({ page: 1, limit: 50 }),
  });

  const items = data?.items ?? [];
  const liveCount = items.filter(({ auction }) =>
    ["active", "postponed"].includes(String(auction.status).toLowerCase())
  ).length;
  const wonCount = items.filter(({ auction }) =>
    String(auction.myResult?.outcome ?? "").startsWith("won")
  ).length;

  return (
    <div className="pb-12 pt-20 sm:pt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-4 flex flex-col gap-3 sm:mb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {dict.dashboard.title}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {dict.dashboard.subtitle}
            </p>
          </div>
          {!isLoading && !error && items.length > 0 && (
            <dl className="grid grid-cols-3 gap-2 md:w-auto md:min-w-[22rem]">
              {[
                { label: dict.dashboard.statJoined, value: items.length, tone: "text-slate-900" },
                { label: dict.dashboard.statLive, value: liveCount, tone: "text-[var(--color-primary-700)]" },
                { label: dict.dashboard.statWon, value: wonCount, tone: "text-emerald-700" },
              ].map((stat) => (
                <div key={stat.label} className="cm-card rounded-xl px-3 py-2">
                  <dt className="truncate text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    {stat.label}
                  </dt>
                  <dd className={`text-xl font-extrabold tabular-nums ${stat.tone}`}>
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </header>

        {isLoading ? (
          <ul className="grid gap-2.5 lg:grid-cols-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="cm-card flex items-center gap-3 rounded-2xl p-3">
                <div className="skeleton h-16 w-16 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </li>
            ))}
          </ul>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center text-sm font-semibold text-red-800">
            {dict.dashboard.loadError}
          </div>
        ) : items.length === 0 ? (
          <div className="cm-card flex flex-col items-center px-6 py-10 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-yellow)] text-slate-900">
              <Gavel className="h-6 w-6" />
            </span>
            <p className="font-extrabold text-slate-900">
              {dict.dashboard.emptyTitle}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {dict.dashboard.emptyDesc}
            </p>
            <Link
              href="/auctions"
              className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-[var(--brand-blue)] px-4 text-sm font-extrabold text-white transition"
            >
              {dict.dashboard.browseAuctions}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <ul className="grid gap-2.5 lg:grid-cols-2">
            {items.map(({ auction, participation, bids }, i) => {
              const statusLabel =
                dict.auctions.filters[
                  auction.status as keyof typeof dict.auctions.filters
                ] ?? String(auction.status);
              const badge = resultBadge(auction, dict, t);
              return (
                <li
                  key={participation.id || auction.id}
                  className="cm-rise"
                  style={{ ["--i" as string]: i }}
                >
                  <Link
                    href={`/auctions/${auction.id}`}
                    className="cm-card cm-card-interactive group flex h-full items-center gap-3 rounded-2xl p-3"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-[4.5rem] sm:w-[4.5rem]">
                      {auctionCoverImage(auction) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={auctionCoverImage(auction) ?? ""}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        {statusLabel}
                      </p>
                      <p className="truncate font-extrabold text-slate-900 group-hover:text-[var(--color-primary-700)]">
                        {auction.title}
                      </p>
                      {bids?.length ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {bids.slice(0, 4).map((b) => (
                            <span
                              key={b.id}
                              className="rounded-md bg-[var(--color-primary-50)] px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-[var(--color-primary-800)]"
                            >
                              {b.bidValue}
                            </span>
                          ))}
                          {bids.length > 4 && (
                            <span className="text-[11px] font-bold text-slate-500">
                              +{bids.length - 4}
                            </span>
                          )}
                          <span className="sr-only">
                            {t("dashboard.bidsPlaced", { count: bids.length })}
                          </span>
                        </div>
                      ) : (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {dict.dashboard.noBidsYet}
                        </p>
                      )}
                    </div>
                    {badge ? (
                      <div className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-right ${badge.className}`}>
                        <p className="text-xs font-extrabold">{badge.label}</p>
                        {badge.sub && (
                          <p className="mt-0.5 text-[11px] font-semibold">{badge.sub}</p>
                        )}
                      </div>
                    ) : (
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--brand-blue)]" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function MyAuctionsPage() {
  return (
    <ProtectedRoute>
      <MyAuctionsContent />
    </ProtectedRoute>
  );
}
