"use client";

import Link from "next/link";
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

  return (
    <div className="bg-slate-50 pb-20 pt-24 sm:pt-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900">
            {dict.dashboard.title}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {dict.dashboard.subtitle}
          </p>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--brand-blue)] border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center text-red-800">
            {dict.dashboard.loadError}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="font-semibold text-slate-900">
              {dict.dashboard.emptyTitle}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {dict.dashboard.emptyDesc}
            </p>
            <Link
              href="/auctions"
              className="mt-4 inline-block text-sm font-bold text-[var(--brand-blue)] hover:underline"
            >
              {dict.dashboard.browseAuctions}
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map(({ auction, participation, bids }) => {
              const statusLabel =
                dict.auctions.filters[
                  auction.status as keyof typeof dict.auctions.filters
                ] ?? String(auction.status);
              const badge = resultBadge(auction, dict, t);
              return (
                <li key={participation.id || auction.id}>
                  <Link
                    href={`/auctions/${auction.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--brand-blue)]/40"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {auctionCoverImage(auction) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={auctionCoverImage(auction) ?? ""}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-slate-900">
                        {auction.title}
                      </p>
                      <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
                        {statusLabel}
                        {bids?.length
                          ? ` · ${t("dashboard.bidsPlaced", { count: bids.length })}`
                          : ` · ${dict.dashboard.noBidsYet}`}
                      </p>
                    </div>
                    {badge ? (
                      <div className={`shrink-0 rounded-xl border px-3 py-2 text-right ${badge.className}`}>
                        <p className="text-xs font-bold">{badge.label}</p>
                        {badge.sub && (
                          <p className="mt-0.5 text-[11px] font-semibold">{badge.sub}</p>
                        )}
                      </div>
                    ) : null}
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
