"use client";

import { Suspense, use, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ProductMediaGallery } from "@/components/media/ProductMediaGallery";
import { auctionMediaItems } from "@/lib/auction-media";
import { AUCTION_GRID_CLASS, AuctionCard } from "@/components/auctions/AuctionCard";
import { AuctionCountdown } from "@/components/auctions/AuctionCountdown";
import { BidPanel } from "@/components/auctions/BidPanel";
import { CompletedAuctionAudit } from "@/components/auctions/CompletedAuctionAudit";
import {
  useAuction,
  useMyBids,
  useMyParticipation,
} from "@/hooks/useAuction";
import { listAuctions } from "@/services/auctions.service";
import { queryKeys } from "@/lib/query-keys";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AuctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { dict, t, formatCurrency } = useLanguage();
  const { data: auction, isLoading, error } = useAuction(id);
  const { data: participation } = useMyParticipation(id);
  const { data: myBids = [] } = useMyBids(id);

  const { data: listData } = useQuery({
    queryKey: queryKeys.auctions.list({ page: 1, limit: 24 }),
    queryFn: () => listAuctions({ page: 1, limit: 24 }),
    refetchInterval: 45_000,
  });

  const recommendedAuctions = useMemo(() => {
    const all = listData?.items ?? [];
    const activeOthers = all.filter(
      (item) =>
        item.id !== id && String(item.status).toLowerCase() === "active"
    );
    return [...activeOthers]
      .sort((a, b) => {
        const aTime = a.closeAt
          ? new Date(a.closeAt).getTime()
          : Number.POSITIVE_INFINITY;
        const bTime = b.closeAt
          ? new Date(b.closeAt).getTime()
          : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      })
      .slice(0, 6);
  }, [listData, id]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-20 sm:px-6 sm:pt-24 lg:px-8" aria-busy="true">
        <div className="skeleton mb-4 h-4 w-28" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8">
          <div className="skeleton aspect-[4/3] w-full rounded-3xl" />
          <div className="space-y-3">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-8 w-3/4" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-5/6" />
            <div className="skeleton mt-4 h-14 w-full rounded-2xl" />
            <div className="skeleton h-48 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-12 pt-24 text-center sm:pt-28">
        <p className="text-lg font-bold text-slate-900">
          {dict.auctionDetail.notFound}
        </p>
        <Link
          href="/auctions"
          className="mt-4 inline-block text-sm font-bold text-[var(--brand-blue)] hover:underline"
        >
          {dict.auctionDetail.backToAuctions}
        </Link>
      </div>
    );
  }

  const statusKey = String(auction.status).toLowerCase();
  const statusLabel =
    statusKey in dict.auctions.filters
      ? dict.auctions.filters[statusKey as keyof typeof dict.auctions.filters]
      : auction.status;

  return (
    <div className="pb-12 pt-20 sm:pt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/auctions"
          className="group mb-3 inline-flex items-center gap-1.5 rounded-full py-1 pr-2 text-sm font-bold text-slate-600 transition-colors hover:text-[var(--color-primary-700)] sm:mb-4"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />{" "}
          {dict.auctionDetail.allAuctions}
        </Link>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <div className="lg:sticky lg:top-24">
            <ProductMediaGallery media={auctionMediaItems(auction)} />
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-blue)]">
                {statusLabel}
                {Number(auction.retailValue) > 0 && (
                  <span className="text-slate-500">
                    {" · "}
                    {t("auctions.worth", {
                      amount: formatCurrency(Number(auction.retailValue)),
                    })}
                  </span>
                )}
              </p>
              <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
                {auction.title}
              </h1>
              {auction.description ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 sm:text-base">
                  {auction.description}
                </p>
              ) : null}
              <AuctionCountdown
                closeAt={auction.closeAt}
                status={auction.status}
                variant="detail"
              />
            </div>

            <Suspense fallback={null}>
              <BidPanel
                auction={auction}
                participating={Boolean(participation?.participating)}
                myBids={myBids}
              />
            </Suspense>
          </div>
        </div>

        {/* Public Audit Log & Verification for completed auctions */}
        {(["executed", "closed"].includes(statusKey) ||
          (statusKey === "cancelled" && auction.winnerPaymentStatus === "unpaid")) && (
          <div className="mt-8">
            <CompletedAuctionAudit auctionId={auction.id} />
          </div>
        )}

        {recommendedAuctions.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="cm-eyebrow">{dict.auctionDetail.recommendedTag}</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  {dict.auctionDetail.recommendedTitle}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {dict.auctionDetail.recommendedSubtitle}
                </p>
              </div>
              <Link
                href="/auctions"
                className="group inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-[var(--color-primary-700)] shadow-xs ring-1 ring-slate-200 transition hover:ring-[var(--brand-blue)]/50"
              >
                {dict.common.viewAll}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className={AUCTION_GRID_CLASS}>
              {recommendedAuctions.slice(0, 4).map((item) => (
                <AuctionCard key={item.id} auction={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

