"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SectionTag } from "@/components/home/SectionTag";
import {
  AUCTION_GRID_CLASS,
  AuctionCard,
  AuctionCardSkeleton,
} from "@/components/auctions/AuctionCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryKeys } from "@/lib/query-keys";
import {
  listAuctions,
  type PublicAuctionCard,
} from "@/services/auctions.service";

const POLL_MS = 45_000;
const HOME_LIMIT = 8;

export function HomeAuctionsSection({
  auctions,
}: {
  auctions: PublicAuctionCard[];
}) {
  const { dict } = useLanguage();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.auctions.list({
      page: 1,
      limit: HOME_LIMIT,
      status: "active",
    }),
    queryFn: () =>
      listAuctions({
        page: 1,
        limit: HOME_LIMIT,
        status: "active",
      }),
    initialData:
      auctions.length > 0
        ? {
            items: auctions,
            total: auctions.length,
            page: 1,
            limit: HOME_LIMIT,
            totalPages: 1,
            hasMore: false,
            statusCounts: {},
          }
        : undefined,
    staleTime: 15_000,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  });

  const items = data?.items ?? auctions;

  return (
    <section className="py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-end justify-between gap-4 sm:mb-6">
          <div>
            <SectionTag align="left">{dict.nav.auctions}</SectionTag>
            <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {dict.home.openAuctions}
            </h2>
          </div>
          <Link
            href="/auctions"
            className="group inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-[var(--color-primary-700)] shadow-xs ring-1 ring-slate-200 transition hover:ring-[var(--brand-blue)]/50"
          >
            {dict.common.viewAll}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        {isLoading && items.length === 0 ? (
          <div className={AUCTION_GRID_CLASS}>
            {Array.from({ length: 8 }).map((_, idx) => (
              <AuctionCardSkeleton key={idx} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="cm-card px-6 py-10 text-center text-sm font-medium text-slate-500">
            {dict.home.noLiveAuctions}
          </div>
        ) : (
          <div className={AUCTION_GRID_CLASS}>
            {items.map((auction, i) => (
              <div key={auction.id} className="cm-rise" style={{ ["--i" as string]: i }}>
                <AuctionCard auction={auction} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
