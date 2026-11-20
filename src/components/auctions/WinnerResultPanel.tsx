"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { toastApiError } from "@/lib/toast-api-error";
import { payWinningBid, type Auction } from "@/services/auctions.service";

/** Ethiopia time, e.g. "Sat 22 Nov, 14:30". */
function formatDeadline(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === "am" ? "am-ET" : "en-GB", {
    timeZone: "Africa/Addis_Ababa",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Result of a drawn auction under "pay only if you win": the winner gets a Pay now card with the
 * deadline; everyone else sees their own outcome and whether the winner has paid.
 */
export function WinnerResultPanel({
  auction,
  verifying,
}: {
  auction: Auction;
  verifying: boolean;
}) {
  const { dict, formatCurrency, t, locale } = useLanguage();
  const now = useNow();
  const my = auction.myResult ?? null;
  const outcome = my?.outcome ?? "";

  const payMutation = useMutation({
    mutationFn: () =>
      payWinningBid(
        auction.id,
        typeof window !== "undefined"
          ? `${window.location.origin}/auctions/${auction.id}`
          : undefined
      ),
    onSuccess: (res) => {
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    },
    onError: (err) => toastApiError(err, dict.auctionDetail.paymentVerifyError),
  });

  const timeLeft = (iso?: string | null): string => {
    if (!iso) return "";
    const ms = new Date(iso).getTime() - now;
    if (!Number.isFinite(ms) || ms <= 60 * 60 * 1000) return dict.auctionDetail.lessThanHour;
    const hours = Math.floor(ms / (60 * 60 * 1000));
    if (hours < 24) return t("auctionDetail.hoursLeft", { count: String(hours) });
    return t("auctionDetail.daysHoursLeft", {
      days: String(Math.floor(hours / 24)),
      hours: String(hours % 24),
    });
  };

  const verifyingBanner = verifying ? (
    <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand-blue)] border-t-transparent" />
      {dict.auctionDetail.verifyingPayment}
    </div>
  ) : null;

  if (outcome === "won_pay_now" && my?.bidValue != null) {
    const amount = formatCurrency(Number(my.bidValue));
    return (
      <div className="space-y-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
        {verifyingBanner}
        <p className="text-lg font-extrabold text-slate-900">{dict.auctionDetail.youWonTitle}</p>
        {(my.attempt ?? 1) > 1 && (
          <p className="text-sm font-medium text-amber-900">{dict.auctionDetail.secondChanceNote}</p>
        )}
        <p className="text-base font-bold text-slate-900">
          {t("auctionDetail.youWonBid", { amount })}
        </p>
        {my.dueAt && (
          <p className="text-sm font-semibold text-amber-900">
            {t("auctionDetail.payByDeadline", {
              date: formatDeadline(my.dueAt, locale),
              left: timeLeft(my.dueAt),
            })}
          </p>
        )}
        <Button
          type="button"
          className="h-12 w-full font-bold"
          disabled={payMutation.isPending || verifying}
          onClick={() => payMutation.mutate()}
        >
          {payMutation.isPending
            ? dict.auctionDetail.redirectingToChapa
            : t("auctionDetail.payWinningBidBtn", { amount })}
        </Button>
        <p className="text-xs text-slate-600">{dict.auctionDetail.passOnWarning}</p>
      </div>
    );
  }

  if (outcome === "won_paid") {
    return (
      <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5">
        {verifyingBanner}
        <p className="text-lg font-extrabold text-emerald-900">{dict.auctionDetail.winnerPaidTitle}</p>
        {my?.bidValue != null && (
          <p className="text-sm font-semibold text-slate-800">
            {t("auctionDetail.youWonBid", { amount: formatCurrency(Number(my.bidValue)) })}
          </p>
        )}
        <p className="text-sm text-slate-700">{dict.auctionDetail.winnerPaidDesc}</p>
      </div>
    );
  }

  // Public summary of the draw, plus the viewer's own outcome when they took part.
  const status = auction.winnerPaymentStatus ?? "";
  const cancelled = auction.status === "cancelled";
  return (
    <div
      className={
        cancelled
          ? "space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5"
          : "space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5"
      }
    >
      {verifyingBanner}
      <p
        className={
          cancelled
            ? "text-xs font-bold uppercase tracking-wider text-slate-500"
            : "text-xs font-bold uppercase tracking-wider text-emerald-700"
        }
      >
        {cancelled ? dict.auctionDetail.cancelled : dict.auctionDetail.auctionComplete}
      </p>

      {outcome === "won_expired" && (
        <div className="rounded-xl border border-slate-200 bg-white/80 px-3.5 py-3">
          <p className="font-bold text-slate-900">{dict.auctionDetail.winExpiredTitle}</p>
          <p className="mt-1 text-sm text-slate-600">{dict.auctionDetail.winExpiredDesc}</p>
        </div>
      )}
      {outcome === "lost" && (
        <div className="rounded-xl border border-slate-200 bg-white/80 px-3.5 py-3">
          <p className="font-bold text-slate-900">{dict.auctionDetail.lostTitle}</p>
          <p className="mt-1 text-sm text-slate-600">{dict.auctionDetail.lostDesc}</p>
        </div>
      )}

      {status === "paid" && auction.winnerName && (
        <p className="text-base font-bold text-slate-900">
          {dict.winners.winner}: <span className="text-emerald-800">{auction.winnerName}</span>
        </p>
      )}
      {status === "awaiting_payment" && (
        <p className="text-sm font-medium text-slate-700">
          {auction.winnerPaymentDueAt
            ? t("auctionDetail.awaitingWinnerPayment", {
                date: formatDeadline(auction.winnerPaymentDueAt, locale),
              })
            : dict.auctionDetail.awaitingWinnerPaymentNoDate}
        </p>
      )}
      {cancelled && status === "unpaid" && (
        <p className="text-sm font-medium text-slate-700">{dict.auctionDetail.cancelledUnpaid}</p>
      )}

      {!cancelled &&
        (auction.winnerBidValue != null ? (
          <p className="text-lg font-bold text-slate-900">
            {t("auctionDetail.winningBid", {
              amount: formatCurrency(Number(auction.winnerBidValue)),
            })}
          </p>
        ) : (
          <p className="text-sm text-slate-600">{dict.auctionDetail.resultsIn}</p>
        ))}
    </div>
  );
}
