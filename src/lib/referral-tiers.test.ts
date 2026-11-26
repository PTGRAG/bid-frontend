import { describe, expect, it } from "vitest";
import {
  addTier,
  chainTiers,
  earningsFor,
  removeTier,
  tierRangeLabel,
  validateProgramDraft,
  type ProgramDraft,
} from "./referral-tiers";

const defaults: ProgramDraft = {
  threshold: 10,
  tiers: [
    { from: 11, to: 25, amount: 5 },
    { from: 26, to: 50, amount: 10 },
    { from: 51, to: null, amount: 20 },
  ],
  netMarginPerBid: 25,
  attributionWindowDays: 30,
};

describe("validateProgramDraft", () => {
  it("accepts the backend defaults", () => {
    expect(validateProgramDraft(defaults)).toBeNull();
  });

  it("enforces the margin guardrail on every tier", () => {
    expect(validateProgramDraft({ ...defaults, netMarginPerBid: 20 })).toMatch(/not below the net margin/);
  });

  it("rejects gaps, falling payouts and a closed last tier", () => {
    const gap = { ...defaults, tiers: [{ from: 11, to: 20, amount: 5 }, { from: 22, to: null, amount: 6 }] };
    expect(validateProgramDraft(gap)).toMatch(/must start at bidder 21/);

    const falling = { ...defaults, tiers: [{ from: 11, to: 20, amount: 8 }, { from: 21, to: null, amount: 6 }] };
    expect(validateProgramDraft(falling)).toMatch(/only rise/);

    const closed = { ...defaults, tiers: [{ from: 11, to: 20, amount: 5 }] };
    expect(validateProgramDraft(closed)).toMatch(/open-ended/);
  });

  it("checks the threshold and window ranges", () => {
    expect(validateProgramDraft({ ...defaults, threshold: -1 })).toMatch(/Threshold/);
    expect(validateProgramDraft({ ...defaults, attributionWindowDays: 0 })).toMatch(/window/);
  });
});

describe("tier editing", () => {
  it("chains tiers after a new threshold", () => {
    expect(chainTiers(5, defaults.tiers)).toEqual([
      { from: 6, to: 25, amount: 5 },
      { from: 26, to: 50, amount: 10 },
      { from: 51, to: null, amount: 20 },
    ]);
    // A threshold past a tier's end pushes the tier's end forward instead of inverting it.
    expect(chainTiers(30, defaults.tiers)[0]).toEqual({ from: 31, to: 31, amount: 5 });
  });

  it("adds a tier by closing the open one", () => {
    const next = addTier(10, defaults.tiers);
    expect(next).toHaveLength(4);
    expect(next[2]).toEqual({ from: 51, to: 75, amount: 20 });
    expect(next[3]).toEqual({ from: 76, to: null, amount: 20 });
    expect(validateProgramDraft({ ...defaults, tiers: next })).toBeNull();
  });

  it("removes a tier and keeps the chain valid", () => {
    const next = removeTier(10, defaults.tiers, 1);
    expect(next).toEqual([
      { from: 11, to: 25, amount: 5 },
      { from: 26, to: null, amount: 20 },
    ]);
    expect(removeTier(10, [defaults.tiers[2]], 0)).toHaveLength(1);
  });
});

describe("earningsFor", () => {
  it("pays nothing below the threshold", () => {
    expect(earningsFor(10, defaults.tiers, 9)).toBe(0);
    expect(earningsFor(10, defaults.tiers, 10)).toBe(0);
  });

  it("pays each bidder at the rate of its tier", () => {
    expect(earningsFor(10, defaults.tiers, 11)).toBe(5);
    expect(earningsFor(10, defaults.tiers, 25)).toBe(75);
    expect(earningsFor(10, defaults.tiers, 30)).toBe(75 + 5 * 10);
    expect(earningsFor(10, defaults.tiers, 60)).toBe(75 + 250 + 10 * 20);
  });

  it("labels ranges", () => {
    expect(tierRangeLabel({ from: 11, to: 25 })).toBe("11–25");
    expect(tierRangeLabel({ from: 51, to: null })).toBe("51+");
  });
});
