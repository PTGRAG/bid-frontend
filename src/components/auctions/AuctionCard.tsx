"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Gavel, Clock, Heart, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PublicAuctionCard } from "@/services/auctions.service";
import { auctionCoverImage } from "@/lib/auction-media";
import {
  formatCountdownParts,
  getCountdownUrgency,
  // getEntrantProgress,
} from "@/lib/auction-card";

function resolveEndsAt(auction: PublicAuctionCard): string | null | undefined {
  return auction.endsAt ?? auction.closeAt;
}

/** First sentence of a description (falls back to a short truncated line). */
function firstDescriptionSentence(text: string | null | undefined): string {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const match = raw.match(/^(.+?[.!?])(?:\s|$)/);
  const sentence = (match?.[1] || raw).trim();
  if (sentence.length <= 140) return sentence;
  return `${sentence.slice(0, 137).trimEnd()}…`;
}

export function AuctionCard({ auction }: { auction: PublicAuctionCard }) {
  const { dict, formatCurrency, t } = useLanguage();

  const normalizedStatus = String(auction.status || "").toLowerCase();
  const isOpen = ["active", "postponed"].includes(normalizedStatus);
  const isEnded =
    !isOpen ||
    ["closed", "executed", "cancelled"].includes(normalizedStatus);
  const cover = auctionCoverImage(auction);

  // const progress = getEntrantProgress(
  //   Number(auction.participantCount ?? 0),
  //   Number(auction.minParticipants ?? 10)
  // );
  // const participantCount = Number(auction.participantCount ?? 0);
  // const minParticipants = Math.max(1, Number(auction.minParticipants ?? 10));
  // const prizeUnlocked = Boolean(auction.prizeUnlocked) || progress.prizeUnlocked;
  const retailValue = Number(auction.retailValue ?? 0);
  const descriptionPreview = firstDescriptionSentence(auction.description);
  const hasJoined = Boolean(auction.userHasJoined);
  const tag = String(auction.tag || "").toLowerCase();

  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("carra_favorites");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.includes(auction.id)) {
          setIsFavorite(true);
        }
      }
    } catch {
      // ignore
    }
  }, [auction.id]);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const stored = localStorage.getItem("carra_favorites");
      const list = stored ? JSON.parse(stored) : [];
      const updated = Array.isArray(list)
        ? isFavorite
          ? list.filter((id: string) => id !== auction.id)
          : [...list, auction.id]
        : [auction.id];
      localStorage.setItem("carra_favorites", JSON.stringify(updated));
      setIsFavorite(!isFavorite);
    } catch {
      setIsFavorite(!isFavorite);
    }
  };

  const endsAtRaw = resolveEndsAt(auction);
  const targetMs = useMemo(() => {
    if (!endsAtRaw) return null;
    const d = new Date(endsAtRaw);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }, [endsAtRaw]);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!targetMs || !isOpen) return;
    setNowMs(Date.now());
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [targetMs, isOpen]);

  const { timeLeft, urgency } = useMemo(() => {
    if (!targetMs) {
      return {
        timeLeft: null as { desktop: string; mobile: string } | null,
        urgency: getCountdownUrgency(isEnded ? 0 : null),
      };
    }
    const diff = targetMs - nowMs;
    return {
      timeLeft: formatCountdownParts(diff),
      urgency: getCountdownUrgency(diff),
    };
  }, [targetMs, nowMs, isEnded]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return dict.auctions.filters.active;
      case "postponed":
        return dict.auctions.filters.postponed;
      case "closed":
        return dict.auctions.filters.closed;
      case "executed":
        return dict.auctions.filters.executed;
      case "cancelled":
        return dict.auctions.filters.cancelled;
      default:
        return status;
    }
  };

  const tagLabel =
    tag === "hot"
      ? dict.auctions.tags.hot
      : tag === "new"
        ? dict.auctions.tags.new
        : tag === "almost_unlocked"
          ? dict.auctions.tags.almostUnlocked
          : null;

  const countdownAria = timeLeft
    ? t("auctions.countdownAria", { time: timeLeft.desktop })
    : dict.auctions.countdown.ended;

  const wishlistAria = isFavorite
    ? dict.auctions.removeFromWishlist
    : dict.auctions.addToWishlist;

  const ctaLabel = isEnded
    ? dict.auctions.ended
    : hasJoined
      ? dict.auctions.placeAnotherBid
      : dict.auctions.joinAndBid;

  const showCountdown = isOpen && timeLeft && urgency !== "ended";

  return (
    <Link
      href={`/auctions/${auction.id}`}
      className="cm-card cm-card-interactive group relative flex h-full flex-col overflow-hidden rounded-2xl"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 sm:aspect-[4/3]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={auction.title}
            loading="lazy"
            decoding="async"
            width={640}
            height={480}
            className={`h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] ${
              isEnded ? "saturate-[0.6]" : ""
            }`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-slate-300">
            <Gavel className="h-9 w-9" aria-hidden />
          </div>
        )}

        <div className="absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-1.5 sm:inset-x-3 sm:top-3">
          {tagLabel && isOpen ? (
            <span className="min-w-0 truncate whitespace-nowrap rounded-full bg-[var(--brand-blue)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm sm:px-2.5 sm:text-xs">
              {tagLabel}
            </span>
          ) : !isOpen ? (
            <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white backdrop-blur-sm sm:px-2.5 sm:text-xs">
              {getStatusLabel(String(auction.status))}
            </span>
          ) : (
            <span />
          )}

          {showCountdown && (
            <span
              aria-label={countdownAria}
              className={[
                "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums shadow-sm sm:px-2.5 sm:text-xs",
                urgency === "critical"
                  ? "bg-red-600 text-white animate-pulse"
                  : urgency === "soon"
                    ? "bg-amber-400 text-slate-900"
                    : "bg-[var(--brand-yellow)] text-black",
              ].join(" ")}
            >
              <Clock className="h-3 w-3 shrink-0" aria-hidden />
              <span className="hidden truncate sm:inline">{timeLeft.desktop}</span>
              <span className="truncate sm:hidden">{timeLeft.mobile}</span>
            </span>
          )}
        </div>

        <div className="absolute inset-x-2 bottom-2 z-10 flex items-end justify-between gap-2 sm:inset-x-3 sm:bottom-3">
          <span className="rounded-lg bg-white/95 px-2 py-1 text-[11px] font-extrabold leading-none text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.15)] ring-1 ring-slate-900/5 backdrop-blur-sm tabular-nums sm:text-sm">
            {t("auctions.entryPill", {
              amount: formatCurrency(auction.entranceFee),
            })}
          </span>
          <button
            type="button"
            onClick={toggleFavorite}
            aria-label={wishlistAria}
            aria-pressed={isFavorite}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-sm transition-transform duration-300 [transition-timing-function:var(--ease-spring)] hover:scale-110 hover:text-rose-500 active:scale-90 sm:h-8 sm:w-8"
          >
            <Heart
              aria-hidden
              className={`h-3.5 w-3.5 transition-colors sm:h-4 sm:w-4 ${
                isFavorite ? "fill-rose-500 text-rose-500" : ""
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-2.5 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-extrabold leading-snug text-slate-900 transition-colors group-hover:text-[var(--color-primary-700)] sm:text-lg">
          {auction.title}
        </h3>

        {retailValue > 0 && (
          <p className="mt-0.5 text-xs font-bold text-slate-500 sm:text-sm">
            {t("auctions.worth", { amount: formatCurrency(retailValue) })}
          </p>
        )}

        {descriptionPreview ? (
          <p className="mt-1.5 hidden line-clamp-2 text-sm leading-snug text-slate-600 sm:block">
            {descriptionPreview}
          </p>
        ) : null}

        <div className="mt-auto pt-2.5 sm:pt-3">
          {!isOpen && auction.winnerName ? (
            <div className="mb-2 flex items-center justify-between gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs ring-1 ring-inset ring-emerald-200/80 sm:text-sm">
              <span className="font-bold text-emerald-800">
                {dict.winners.winner}
              </span>
              <span className="truncate font-extrabold text-emerald-950">
                {auction.winnerName}
              </span>
            </div>
          ) : null}

          {isEnded ? (
            <span
              aria-disabled="true"
              className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-slate-100 px-3 text-xs font-extrabold text-slate-500 sm:h-10 sm:text-sm"
            >
              {dict.auctions.ended}
            </span>
          ) : (
            <span
              className={[
                "btn-shine inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-extrabold transition-all duration-200 sm:h-10 sm:text-sm",
                hasJoined
                  ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] ring-1 ring-inset ring-[var(--color-primary-200)] group-hover:bg-[var(--brand-blue)] group-hover:text-white group-hover:ring-transparent"
                  : "bg-[var(--brand-blue)] text-white shadow-[var(--shadow-glow)] group-hover:bg-[var(--color-primary-600)]",
              ].join(" ")}
            >
              <Gavel className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
              <span className="truncate">{ctaLabel}</span>
              <ArrowRight
                className="hidden h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 sm:inline"
                aria-hidden
              />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Loading placeholder with the same footprint as AuctionCard. */
export function AuctionCardSkeleton() {
  return (
    <div className="cm-card flex flex-col overflow-hidden rounded-2xl" aria-hidden>
      <div className="skeleton aspect-square w-full rounded-none sm:aspect-[4/3]" />
      <div className="space-y-2 p-2.5 sm:p-4">
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton mt-3 h-9 w-full rounded-xl sm:h-10" />
      </div>
    </div>
  );
}

/** Shared responsive grid for auction cards: two up on phones, four on wide screens. */
export const AUCTION_GRID_CLASS =
  "grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4";
