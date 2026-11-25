/**
 * Pure helpers for the agent dashboard: the payout ladder an agent climbs and the links they
 * share. The backend computes earnings; these only shape that data for display.
 */

import type { ReferralEarnings, ReferralTier } from "@/services/referrals.service";

export type LadderState = "done" | "current" | "upcoming";

export interface LadderStep {
  /** First bidder number in this step (1-based). */
  from: number;
  /** Last bidder number, or null for the open-ended top tier. */
  to: number | null;
  /** ETB paid per bidder in this step. 0 for the unlock step. */
  amount: number;
  /** Qualified bidders counted in this step so far. */
  bidders: number;
  subtotal: number;
  /** The unlock step (bidders 1..threshold) pays nothing. */
  isUnlock: boolean;
  state: LadderState;
}

/**
 * The unlock step followed by each paid tier. The "current" step is the one the agent's next
 * qualified bidder falls into, matching the backend's `currentRate`.
 */
export function payoutLadder(
  threshold: number,
  tiers: ReferralTier[],
  earnings: Pick<ReferralEarnings, "qualified" | "tiers">
): LadderStep[] {
  const qualified = Math.max(0, earnings.qualified || 0);
  const next = qualified + 1;
  const stateFor = (from: number, to: number | null): LadderState => {
    if (next < from) return "upcoming";
    if (to === null || next <= to) return "current";
    return "done";
  };

  const steps: LadderStep[] = [];
  if (threshold > 0) {
    const bidders = Math.min(qualified, threshold);
    steps.push({
      from: 1,
      to: threshold,
      amount: 0,
      bidders,
      subtotal: 0,
      isUnlock: true,
      state: stateFor(1, threshold),
    });
  }
  tiers.forEach((tier, i) => {
    const to = tier.to ?? null;
    const progress = earnings.tiers?.[i];
    const bidders =
      progress && progress.from === tier.from
        ? progress.bidders
        : Math.max(0, Math.min(qualified, to ?? qualified) - tier.from + 1);
    steps.push({
      from: tier.from,
      to,
      amount: tier.amount,
      bidders,
      subtotal: progress && progress.from === tier.from ? progress.subtotal : bidders * tier.amount,
      isUnlock: false,
      state: stateFor(tier.from, to),
    });
  });
  return steps;
}

/** Percent of the unlock threshold reached, 0–100. */
export function thresholdPercent(qualified: number, threshold: number): number {
  if (threshold <= 0) return 100;
  return Math.max(0, Math.min(100, (qualified / threshold) * 100));
}

/** "11–25", "51+", or "7" for a single-number step. */
export function stepRangeLabel(step: { from: number; to: number | null }): string {
  if (step.to === null) return `${step.from}+`;
  if (step.to === step.from) return String(step.from);
  return `${step.from}–${step.to}`;
}

/** Telegram's share sheet for a link and a short message. */
export function telegramShareUrl(link: string, text: string): string {
  const params = new URLSearchParams({ url: link, text });
  return `https://t.me/share/url?${params.toString()}`;
}
