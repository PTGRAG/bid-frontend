/**
 * Client-side mirror of the backend's payout rules (core/domain/referral.go), used by the
 * staff program editor to validate and preview a change before saving it. The backend stays
 * the source of truth and validates again on save.
 */

export interface TierDraft {
  from: number;
  to?: number | null;
  amount: number;
}

export const MAX_REFERRAL_THRESHOLD = 100_000;
export const MAX_ATTRIBUTION_DAYS = 365;

export interface ProgramDraft {
  threshold: number;
  tiers: TierDraft[];
  netMarginPerBid: number;
  attributionWindowDays: number;
}

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

/** Returns the first rule the draft breaks, or null when it is valid. */
export function validateProgramDraft(p: ProgramDraft): string | null {
  if (!isInt(p.threshold) || p.threshold < 0 || p.threshold > MAX_REFERRAL_THRESHOLD) {
    return `Threshold must be a whole number between 0 and ${MAX_REFERRAL_THRESHOLD}`;
  }
  if (!isInt(p.attributionWindowDays) || p.attributionWindowDays < 1 || p.attributionWindowDays > MAX_ATTRIBUTION_DAYS) {
    return `Attribution window must be between 1 and ${MAX_ATTRIBUTION_DAYS} days`;
  }
  if (!(p.netMarginPerBid > 0)) return "Net margin per bid must be more than 0 ETB";
  if (!p.tiers.length) return "Add at least one payout tier";

  let next = p.threshold + 1;
  let prev = 0;
  for (let i = 0; i < p.tiers.length; i++) {
    const t = p.tiers[i];
    const n = i + 1;
    const last = i === p.tiers.length - 1;
    if (t.from !== next) return `Tier ${n} must start at bidder ${next}`;
    if (!(t.amount >= 0)) return `Tier ${n} needs an amount of 0 ETB or more`;
    if (t.amount < prev) return `Tier ${n} pays less than the tier before it; payouts may only rise`;
    if (t.amount >= p.netMarginPerBid) {
      return `Tier ${n} pays ${t.amount} ETB per bidder, which is not below the net margin per bid (${p.netMarginPerBid} ETB)`;
    }
    const open = t.to === undefined || t.to === null;
    if (open && !last) return "Only the last tier may be open-ended";
    if (!open) {
      if (last) return "The last tier must be open-ended";
      if (!isInt(t.to) || (t.to as number) < t.from) return `Tier ${n} ends before it starts`;
      next = (t.to as number) + 1;
    }
    prev = t.amount;
  }
  return null;
}

/**
 * Rewrites each tier's `from` so the tiers start right after the threshold and run on without
 * gaps. Editors only let staff change `to` and `amount`; this keeps the rest consistent.
 */
export function chainTiers(threshold: number, tiers: TierDraft[]): TierDraft[] {
  let next = Math.max(0, Math.floor(threshold)) + 1;
  return tiers.map((t, i) => {
    const last = i === tiers.length - 1;
    const from = next;
    let to: number | null = last ? null : (t.to ?? from);
    if (to !== null && to < from) to = from;
    if (to !== null) next = to + 1;
    return { from, to, amount: t.amount };
  });
}

/** Adds a tier after the last one, closing the previous open-ended tier. */
export function addTier(threshold: number, tiers: TierDraft[]): TierDraft[] {
  if (!tiers.length) return chainTiers(threshold, [{ from: 0, to: null, amount: 0 }]);
  const lastTier = tiers[tiers.length - 1];
  const span = 25;
  const closed = { ...lastTier, to: lastTier.from + span - 1 };
  return chainTiers(threshold, [...tiers.slice(0, -1), closed, { from: 0, to: null, amount: lastTier.amount }]);
}

export function removeTier(threshold: number, tiers: TierDraft[], index: number): TierDraft[] {
  if (tiers.length <= 1) return tiers;
  return chainTiers(threshold, tiers.filter((_, i) => i !== index));
}

/** What an agent earns for `qualified` bidders: nothing until the threshold, then per tier. */
export function earningsFor(threshold: number, tiers: TierDraft[], qualified: number): number {
  if (qualified < threshold) return 0;
  let total = 0;
  for (const t of tiers) {
    if (qualified < t.from) continue;
    const upper = t.to === undefined || t.to === null ? qualified : Math.min(t.to, qualified);
    total += (upper - t.from + 1) * t.amount;
  }
  return Math.round(total * 100) / 100;
}

export function tierRangeLabel(t: { from: number; to?: number | null }): string {
  return t.to === undefined || t.to === null ? `${t.from}+` : t.from === t.to ? `${t.from}` : `${t.from}–${t.to}`;
}
