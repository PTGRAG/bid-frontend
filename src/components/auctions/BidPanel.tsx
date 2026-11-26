"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryKeys } from "@/lib/query-keys";
import { toastApiError } from "@/lib/toast-api-error";
import {
  freeBidsApplicable,
  getMyFreeBids,
  participateInAuction,
  updateBid,
  verifyChapaPayment,
  type Auction,
  type Bid,
} from "@/services/auctions.service";
import { AnalyticsEvents, track } from "@/lib/analytics";
import { WinnerResultPanel } from "@/components/auctions/WinnerResultPanel";

const MAX_PACK = 10;

function isBidAlreadyUpdated(bid: Bid): boolean {
  if (bid.canUpdate === false) return true;
  if ((bid.updateCount ?? 0) >= 1) return true;
  if (bid.placedAt && bid.updatedAt) {
    const placed = new Date(bid.placedAt).getTime();
    const updated = new Date(bid.updatedAt).getTime();
    if (!Number.isNaN(placed) && !Number.isNaN(updated) && updated - placed > 100) {
      return true;
    }
  }
  return false;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function BidPanel({
  auction,
  participating,
  myBids,
}: {
  auction: Auction;
  participating: boolean;
  myBids: Bid[];
}) {
  const { user } = useAuth();
  const { dict, formatCurrency, t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [draftValue, setDraftValue] = useState("");
  const [packTags, setPackTags] = useState<number[]>([]);
  const [packError, setPackError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const verifiedRef = useRef<string | null>(null);
  const draftRef = useRef<HTMLInputElement>(null);

  const isOpen =
    auction.status === "active" || auction.status === "postponed";
  const hasJoined = Boolean(user) && (participating || myBids.length > 0);
  const canBid = hasJoined && isOpen;
  // const totalBidsCount = auction.totalBids ?? 0;
  const entranceFeeNum = Number(auction.entranceFee || 0);
  const draftAmountNum = roundMoney(Number.parseFloat(draftValue));
  const hasValidDraft =
    draftValue.trim() !== "" &&
    Number.isFinite(draftAmountNum) &&
    draftAmountNum > 0;
  const effectiveBids =
    packTags.length > 0 ? packTags : hasValidDraft ? [draftAmountNum] : [];
  // Pay only if you win: a ticket costs the entrance fee only. The bid amount is never charged
  // here; the winner pays it after the draw. The server decides free-entrance eligibility and
  // checkout re-validates it.
  const freeEligible = Boolean(auction.userEligibleForFreeEntrance);
  const freeUnlimited = Boolean(auction.freeEntranceUnlimited);
  const freeRemaining = Number(auction.freeEntranceRemaining ?? 0);
  const freeLimit = Number(auction.freeEntranceLimit ?? 0);
  // Near-miss free bids: each covers one more ticket's entrance fee. The server re-checks the
  // balance at checkout (409 when it dropped).
  const freeBidsQuery = useQuery({
    queryKey: queryKeys.me.freeBids(),
    queryFn: getMyFreeBids,
    enabled: Boolean(user) && isOpen,
    staleTime: 30_000,
  });
  const freeBidBalance =
    entranceFeeNum > 0 ? (freeBidsQuery.data?.available ?? 0) : 0;
  const freeBidsUsed = freeBidsApplicable(
    freeBidBalance,
    effectiveBids.length,
    freeEligible
  );
  const anyFree = freeEligible || freeBidsUsed > 0;
  // Free entrance makes the FIRST ticket (index 0) free and each free bid one more; every other
  // ticket pays the entrance fee. Mirrors domain.CheckoutChargeWithFreeBids on the server.
  const feeBidCount =
    Math.max(effectiveBids.length - (freeEligible ? 1 : 0), 0) - freeBidsUsed;
  const packEntranceSum = roundMoney(feeBidCount * entranceFeeNum);
  const packTotal = packEntranceSum;
  const existingValues = new Set(
    myBids.map((b) => roundMoney(Number(b.bidValue)).toFixed(2))
  );

  const invalidate = () => {
    void qc.invalidateQueries({
      queryKey: queryKeys.auctions.detail(auction.id),
    });
    void qc.invalidateQueries({
      queryKey: queryKeys.auctions.myBids(auction.id),
    });
    void qc.invalidateQueries({
      queryKey: queryKeys.auctions.myParticipation(auction.id),
    });
  };

  const clearPendingChapa = () => {
    try {
      sessionStorage.removeItem(`carramarket_pending_chapa_${auction.id}`);
    } catch {
      /* ignore */
    }
  };

  const finishVerifyUI = (verified: boolean, winnerPayment = false) => {
    clearPendingChapa();
    setPackTags([]);
    invalidate();
    void qc.invalidateQueries({ queryKey: [...queryKeys.all, "me"] });
    router.replace(`/auctions/${auction.id}`);
    if (verified) {
      toast.success(
        winnerPayment
          ? dict.auctionDetail.winnerPaymentSuccess
          : dict.auctionDetail.paymentVerifiedSuccess
      );
    }
  };

  const verifyMutation = useMutation({
    mutationFn: ({ txRef }: { txRef: string }) => {
      // Chapa reports "pending" for a few seconds after the return redirect. Poll briefly
      // instead of treating that as the final answer (the server never fails a pending payment).
      return (async () => {
        const MAX_ATTEMPTS = 6;
        let last: Awaited<ReturnType<typeof verifyChapaPayment>> | undefined;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 20000);
          try {
            last = await verifyChapaPayment(txRef, controller.signal);
          } finally {
            window.clearTimeout(timeout);
          }
          const inFlight = ["pending", "created", "processing", "initiated"].includes(
            String(last.status ?? "").toLowerCase()
          );
          const isWinnerPayment = last.purpose === "winner";
          if (last.verified || (!isWinnerPayment && last.participating) || !inFlight) return last;
          if (attempt < MAX_ATTEMPTS - 1) {
            await new Promise((r) => window.setTimeout(r, 3000));
          }
        }
        return last!;
      })();
    },
    onSuccess: (res) => {
      track(AnalyticsEvents.PaymentVerified, {
        auction_id: auction.id,
        verified: Boolean(res.verified),
      });
      const winnerPayment = res.purpose === "winner";
      const done = winnerPayment
        ? Boolean(res.verified)
        : Boolean(res.verified || res.participating);
      finishVerifyUI(done, winnerPayment);
      if (
        !done &&
        ["pending", "created", "processing", "initiated"].includes(
          String(res.status ?? "").toLowerCase()
        )
      ) {
        toast.info(dict.auctionDetail.paymentStillProcessing);
      }
    },
    onError: (err) => {
      track(AnalyticsEvents.PaymentVerifyFailed, { auction_id: auction.id });
      // Webhook may already have fulfilled — refresh and drop the spinner.
      clearPendingChapa();
      invalidate();
      router.replace(`/auctions/${auction.id}`);
      toastApiError(err, dict.auctionDetail.paymentVerifyError);
    },
  });

  useEffect(() => {
    // Back from paying the winning bid: always verify (the winner has of course already joined).
    const winnerReturnRef =
      searchParams.get("winner_payment") === "1"
        ? searchParams.get("tx_ref") || searchParams.get("trx_ref") || searchParams.get("txRef")
        : null;
    if (winnerReturnRef) {
      if (verifiedRef.current !== winnerReturnRef) {
        verifiedRef.current = winnerReturnRef;
        verifyMutation.mutate({ txRef: winnerReturnRef });
      }
      return;
    }

    // Already joined (e.g. webhook fulfilled while on Chapa) — don't keep verifying.
    if (participating || myBids.length > 0) {
      const hasReturnRef =
        searchParams.get("tx_ref") ||
        searchParams.get("trx_ref") ||
        searchParams.get("txRef");
      if (hasReturnRef) {
        clearPendingChapa();
        router.replace(`/auctions/${auction.id}`);
      } else {
        clearPendingChapa();
      }
      return;
    }

    const urlTxRef =
      searchParams.get("tx_ref") ||
      searchParams.get("trx_ref") ||
      searchParams.get("txRef");
    let txRefToVerify = urlTxRef || "";

    if (!txRefToVerify) {
      try {
        const stored = sessionStorage.getItem(
          `carramarket_pending_chapa_${auction.id}`
        );
        if (stored) {
          const parsed = JSON.parse(stored) as {
            txRef?: string;
            ts?: number;
          };
          if (
            parsed.txRef &&
            (!parsed.ts || Date.now() - parsed.ts < 30 * 60 * 1000)
          ) {
            txRefToVerify = parsed.txRef;
          }
        }
      } catch {
        // ignore
      }
    }

    if (txRefToVerify && verifiedRef.current !== txRefToVerify) {
      verifiedRef.current = txRefToVerify;
      verifyMutation.mutate({ txRef: txRefToVerify });
    }
  }, [auction.id, searchParams, participating, myBids.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateBidAmount = (value: number, silent = false): boolean => {
    if (!Number.isFinite(value) || value <= 0) {
      if (!silent) setPackError(dict.auctionDetail.invalidBidError);
      return false;
    }
    const min = auction.minBidValue ?? 0.01;
    if (value < min) {
      if (!silent) {
        setPackError(`${dict.auctionDetail.bidRange}: ${formatCurrency(min)}+`);
      }
      return false;
    }
    if (auction.maxBidValue != null && value > Number(auction.maxBidValue)) {
      if (!silent) {
        setPackError(
          `${dict.auctionDetail.bidRange}: ${formatCurrency(min)} – ${formatCurrency(
            Number(auction.maxBidValue)
          )}`
        );
      }
      return false;
    }
    return true;
  };

  const addTag = () => {
    setPackError(null);
    if (packTags.length >= MAX_PACK) {
      setPackError(dict.auctionDetail.maxPackReached);
      return;
    }
    const value = roundMoney(Number.parseFloat(draftValue));
    if (!validateBidAmount(value)) return;

    const key = value.toFixed(2);
    if (packTags.some((t) => t.toFixed(2) === key)) {
      setPackError(dict.auctionDetail.duplicatePackBid);
      return;
    }
    if (existingValues.has(key)) {
      setPackError(dict.auctionDetail.duplicateExistingBid);
      return;
    }

    setPackTags((prev) => [...prev, value]);
    setDraftValue("");
    draftRef.current?.focus();
  };

  const removeTag = (index: number) => {
    setPackError(null);
    setPackTags((prev) => prev.filter((_, i) => i !== index));
  };

  const participateMutation = useMutation({
    mutationFn: (bidValues: number[]) => {
      const returnUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/auctions/${auction.id}`
          : undefined;
      return participateInAuction(auction.id, {
        bidValues,
        returnUrl,
        // We quoted a waived entrance fee: if the slot is gone the server answers 409
        // instead of silently charging the fee.
        expectEntranceFree: freeEligible,
        expectFreeBids: freeBidsUsed,
      });
    },
    onSuccess: (result, bidValues) => {
      if (result.checkoutUrl) {
        track(AnalyticsEvents.PaymentStarted, {
          auction_id: auction.id,
          bid_count: bidValues.length,
          tx_ref: result.txRef || undefined,
        });
        try {
          if (result.txRef) {
            sessionStorage.setItem(
              `carramarket_pending_chapa_${auction.id}`,
              JSON.stringify({
                txRef: result.txRef,
                bidValues,
                ts: Date.now(),
              })
            );
          }
        } catch {
          // ignore storage errors
        }
        window.location.href = result.checkoutUrl;
        return;
      }
      // One free ticket: issued right away, nothing to pay at Chapa.
      toast.success(
        result.verified || result.participating
          ? dict.auctionDetail.freeTicketSuccess
          : dict.auctionDetail.joinSuccess
      );
      setPackTags([]);
      invalidate();
      void qc.invalidateQueries({ queryKey: queryKeys.me.freeBids() });
    },
    onError: (err) => {
      toastApiError(err, dict.auctionDetail.joinError);
      // Free entrance or free bids may have changed: refresh the quote.
      if (freeEligible) invalidate();
      if (freeBidsUsed > 0) {
        void qc.invalidateQueries({ queryKey: queryKeys.me.freeBids() });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) =>
      updateBid(id, value),
    onSuccess: () => {
      toast.success(dict.auctionDetail.bidUpdatedSuccess);
      setEditingId(null);
      invalidate();
    },
    onError: (err) => toastApiError(err, dict.auctionDetail.couldNotUpdateBid),
  });

  const requireLogin = () => {
    router.push(`/login?redirect=${encodeURIComponent(`/auctions/${auction.id}`)}`);
  };

  const submitPack = () => {
    setPackError(null);
    let bidsToSubmit = [...packTags];

    // If user typed a bid in the input box and clicked Pay directly (or pressed Pay with a draft),
    // validate and include it automatically.
    if (draftValue.trim() !== "") {
      if (bidsToSubmit.length >= MAX_PACK) {
        setPackError(dict.auctionDetail.maxPackReached);
        return;
      }
      const value = roundMoney(Number.parseFloat(draftValue));
      if (!validateBidAmount(value)) return;
      const key = value.toFixed(2);
      if (existingValues.has(key)) {
        setPackError(dict.auctionDetail.duplicateExistingBid);
        return;
      }
      if (!bidsToSubmit.some((t) => t.toFixed(2) === key)) {
        bidsToSubmit.push(value);
      }
      setDraftValue("");
      setPackTags(bidsToSubmit);
    }

    if (bidsToSubmit.length === 0) {
      setPackError(dict.auctionDetail.addAtLeastOneBid);
      return;
    }
    participateMutation.mutate(bidsToSubmit);
  };

  if (auction.status === "executed" || auction.status === "cancelled") {
    const drawn =
      auction.status === "executed" ||
      Boolean(auction.winnerPaymentStatus) ||
      Boolean(auction.myResult && auction.myResult.outcome !== "cancelled");
    if (drawn) {
      return <WinnerResultPanel auction={auction} verifying={verifyMutation.isPending} />;
    }
    return (
      <div className="cm-card p-4 text-sm font-medium text-slate-600 sm:p-5">
        {dict.auctionDetail.cancelled}
      </div>
    );
  }

  if (auction.status === "closed") {
    return (
      <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm font-medium text-amber-900 sm:p-5">
        <p>{dict.auctionDetail.biddingClosed}</p>
        {/* Total bids temporarily hidden
        {hasJoined && (
          <div className="flex items-center justify-between rounded-xl border border-amber-200/80 bg-white/80 px-3.5 py-2.5 text-sm">
            <span className="font-semibold text-slate-600">
              {dict.auctionDetail.totalBids}
            </span>
            <span className="font-extrabold text-amber-900">
              {totalBidsCount.toLocaleString()}
            </span>
          </div>
        )}
        */}
      </div>
    );
  }

  return (
    <div className="cm-card space-y-4 p-4 sm:p-5">
      <div className="-mx-4 -mt-4 flex items-start justify-between gap-4 rounded-t-[1.25rem] border-b border-slate-100 bg-gradient-to-br from-[var(--color-primary-50)] to-white px-4 pb-3.5 pt-4 sm:-mx-5 sm:-mt-5 sm:px-5 sm:pt-5">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-primary-700)]">
            {dict.auctionDetail.entranceFee}
          </p>
          <p className="flex flex-wrap items-baseline gap-2 text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">
            <span>{formatCurrency(auction.entranceFee)}</span>
            <span className="text-sm font-semibold text-slate-500">
              {dict.auctionDetail.perBid}
            </span>
            {freeEligible && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase text-emerald-800">
                {dict.auctionDetail.freeFirstBidBadge}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {dict.auctionDetail.bidRange}: {formatCurrency(auction.minBidValue ?? 0.01)}
            {auction.maxBidValue != null
              ? ` – ${formatCurrency(Number(auction.maxBidValue))}`
              : "+"}
          </p>
        </div>
        {/* Total bids temporarily hidden
        {hasJoined && (
          <div className="shrink-0 rounded-xl border border-sky-200 bg-sky-50/80 px-3.5 py-2 text-right">
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
              {dict.auctionDetail.totalBids}
            </p>
            <p className="text-xl font-extrabold text-[var(--brand-blue)]">
              {totalBidsCount.toLocaleString()}
            </p>
          </div>
        )}
        */}
      </div>

      {verifyMutation.isPending && !hasJoined && (
        <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
          <span className="cm-dots text-[var(--brand-blue)]" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          {dict.auctionDetail.verifyingPayment}
        </div>
      )}

      {!user ? (
        <Button size="lg" className="w-full font-extrabold" onClick={requireLogin}>
          {dict.auctionDetail.loginToJoin}
        </Button>
      ) : (
        <>
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-800">
              {dict.auctionDetail.yourBidValue}
            </label>
            <div className="flex gap-2">
              <Input
                ref={draftRef}
                type="number"
                step="0.01"
                min={auction.minBidValue ?? 0.01}
                max={auction.maxBidValue ?? undefined}
                value={draftValue}
                onChange={(e) => {
                  setPackError(null);
                  setDraftValue(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder={dict.auctionDetail.bidPlaceholder}
                disabled={!isOpen || participateMutation.isPending}
                className="h-12 text-lg font-extrabold tabular-nums placeholder:text-base placeholder:font-medium md:text-lg"
              />
              <Button
                type="button"
                variant="outline"
                className="h-12 shrink-0 gap-1 px-4 font-bold"
                onClick={addTag}
                disabled={
                  !isOpen ||
                  participateMutation.isPending ||
                  packTags.length >= MAX_PACK
                }
              >
                <Plus className="h-4 w-4" />
                {dict.auctionDetail.addBidBtn}
              </Button>
            </div>
            <p className="text-xs text-slate-500">{dict.auctionDetail.addBidHint}</p>

            {effectiveBids.length > 0 && (
              <div className="space-y-2">
                {packTags.length > 0 && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {dict.auctionDetail.yourPack}
                      </p>
                      <span className="text-xs font-semibold text-slate-500">
                        {t("auctionDetail.packCount", {
                          count: String(packTags.length),
                        })}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {packTags.map((value, index) => (
                        <span
                          key={`${value.toFixed(2)}-${index}`}
                          className="cm-rise inline-flex items-center gap-1 rounded-full border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] py-1 pl-3 pr-1.5 text-sm font-extrabold tabular-nums text-[var(--color-primary-800)]"
                        >
                          {formatCurrency(value)}
                          <button
                            type="button"
                            aria-label={dict.auctionDetail.removeBidAria}
                            className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                            onClick={() => removeTag(index)}
                            disabled={participateMutation.isPending}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {freeEligible ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs font-medium text-emerald-900">
                    <p>
                      {freeUnlimited
                        ? dict.auctionDetail.freeEntranceBannerAll
                        : t("auctionDetail.freeEntranceBanner", {
                            limit: String(freeLimit),
                          })}
                    </p>
                    {!freeUnlimited && freeRemaining > 0 && (
                      <p className="mt-1 font-bold">
                        {t("auctionDetail.freeEntranceSpotsLeft", {
                          count: String(freeRemaining),
                        })}
                      </p>
                    )}
                  </div>
                ) : Boolean(auction.freeEntranceEnabled) &&
                  Boolean(user) &&
                  !hasJoined ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-950">
                    {freeUnlimited || freeRemaining > 0
                      ? dict.auctionDetail.freeEntranceUsed
                      : dict.auctionDetail.freeEntranceGone}
                  </div>
                ) : null}
                {freeBidBalance > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs font-medium text-emerald-900">
                    {t("auctionDetail.freeBidsBalance", {
                      count: String(freeBidBalance),
                    })}
                  </div>
                )}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs text-slate-600 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>
                      {t("auctionDetail.ticketsLabel", {
                        count: String(effectiveBids.length),
                        fee: formatCurrency(entranceFeeNum),
                      })}
                    </span>
                    {anyFree ? (
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="text-slate-400 line-through">
                          {formatCurrency(roundMoney(effectiveBids.length * entranceFeeNum))}
                        </span>
                        {packEntranceSum > 0 ? (
                          <span className="text-slate-800">
                            {formatCurrency(packEntranceSum)}
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase text-emerald-800">
                            {dict.auctionDetail.freeLabel}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(packEntranceSum)}
                      </span>
                    )}
                  </div>
                  {freeEligible && packEntranceSum > 0 && (
                    <p className="text-[11px] font-medium text-emerald-700">
                      {dict.auctionDetail.freeFirstBidLine}
                    </p>
                  )}
                  {freeBidsUsed > 0 && (
                    <p className="text-[11px] font-medium text-emerald-700">
                      {t("auctionDetail.freeBidsApplied", {
                        count: String(freeBidsUsed),
                      })}
                    </p>
                  )}
                  <div className="flex items-center justify-between border-t border-slate-200 pt-1 text-slate-900 font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(packTotal)}</span>
                  </div>
                  <p className="text-[11px] font-semibold text-[var(--brand-blue)]">
                    {dict.auctionDetail.payOnlyIfWinNote}
                  </p>
                </div>
              </div>
            )}

            {packError && (
              <p className="text-xs font-medium text-red-600">{packError}</p>
            )}

            <p className="text-xs text-slate-500">
              {dict.auctionDetail.oneUpdateNotice}
            </p>

            <Button
              type="button"
              size="lg"
              className="w-full font-extrabold"
              disabled={
                !isOpen ||
                participateMutation.isPending ||
                (packTags.length === 0 && !hasValidDraft)
              }
              onClick={submitPack}
            >
              {participateMutation.isPending
                ? dict.auctionDetail.redirectingToChapa
                : anyFree && effectiveBids.length > 0 && packTotal === 0
                  ? dict.auctionDetail.getFreeTicketBtn
                  : freeEligible && effectiveBids.length <= 1
                  ? dict.auctionDetail.getFreeTicketBtn
                  : t(
                      effectiveBids.length <= 1
                        ? "auctionDetail.placeOneAndPayChapa"
                        : "auctionDetail.placePackAndPayChapa",
                      {
                      count: String(Math.max(effectiveBids.length, 1)),
                      amount: formatCurrency(
                        effectiveBids.length > 0 ? packTotal : entranceFeeNum
                      ),
                      }
                    )}
            </Button>
          </div>

          {myBids.length > 0 && (
            <div className="border-t border-slate-100 pt-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {dict.auctionDetail.yourBids}
                </p>
                {/* Total bids temporarily hidden
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {dict.auctionDetail.totalBids}: {totalBidsCount.toLocaleString()}
                </span>
                */}
              </div>
              <ul className="space-y-2">
                {myBids.map((bid) => {
                  const alreadyUpdated = isBidAlreadyUpdated(bid);
                  return (
                    <li
                      key={bid.id}
                      className="cm-rise flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm"
                    >
                      {editingId === bid.id ? (
                        <form
                          className="flex w-full items-center gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const value = Number.parseFloat(editValue);
                            if (!validateBidAmount(value)) return;
                            updateMutation.mutate({ id: bid.id, value });
                          }}
                        >
                          <Input
                            type="number"
                            step="0.01"
                            min={auction.minBidValue ?? 0.01}
                            max={auction.maxBidValue ?? undefined}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-9"
                          />
                          <Button
                            type="submit"
                            size="sm"
                            disabled={updateMutation.isPending}
                          >
                            {dict.common.save}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            {dict.common.cancel}
                          </Button>
                        </form>
                      ) : (
                        <>
                          <span className="font-bold text-slate-900">
                            {formatCurrency(bid.bidValue)}
                          </span>
                          {alreadyUpdated ? (
                            <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                              {dict.auctionDetail.bidUpdateUsedBadge}
                            </span>
                          ) : (
                            canBid && (
                              <button
                                type="button"
                                className="rounded-lg bg-[var(--brand-blue)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--brand-blue)] transition hover:bg-[var(--brand-blue)]/20"
                                onClick={() => {
                                  setEditingId(bid.id);
                                  setEditValue(String(bid.bidValue));
                                }}
                              >
                                {dict.auctionDetail.updateBidOnceBtn}
                              </button>
                            )
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
