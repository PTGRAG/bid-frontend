import { describe, expect, it } from "vitest";
import { payoutLadder, stepRangeLabel, telegramShareUrl, thresholdPercent } from "./agent-dashboard";

const tiers = [
  { from: 11, to: 25, amount: 5 },
  { from: 26, to: 50, amount: 10 },
  { from: 51, amount: 20 },
];

describe("payoutLadder", () => {
  it("puts a new agent on the unlock step", () => {
    const steps = payoutLadder(10, tiers, { qualified: 0, tiers: [] });
    expect(steps).toHaveLength(4);
    expect(steps[0]).toMatchObject({ from: 1, to: 10, amount: 0, isUnlock: true, state: "current", bidders: 0 });
    expect(steps.slice(1).every((s) => s.state === "upcoming")).toBe(true);
  });

  it("moves to the first paid tier once the threshold is reached", () => {
    const steps = payoutLadder(10, tiers, { qualified: 10, tiers: [] });
    expect(steps[0]).toMatchObject({ state: "done", bidders: 10 });
    expect(steps[1]).toMatchObject({ state: "current", bidders: 0 });
  });

  it("uses the backend's per-tier counts and subtotals", () => {
    const steps = payoutLadder(10, tiers, {
      qualified: 30,
      tiers: [
        { from: 11, to: 25, amount: 5, bidders: 15, subtotal: 75 },
        { from: 26, to: 50, amount: 10, bidders: 5, subtotal: 50 },
        { from: 51, amount: 20, bidders: 0, subtotal: 0 },
      ],
    });
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "current", "upcoming"]);
    expect(steps[1]).toMatchObject({ bidders: 15, subtotal: 75 });
    expect(steps[2]).toMatchObject({ bidders: 5, subtotal: 50 });
  });

  it("keeps the open-ended top tier current forever", () => {
    const steps = payoutLadder(10, tiers, { qualified: 500, tiers: [] });
    expect(steps[3]).toMatchObject({ state: "current", to: null, bidders: 450 });
  });

  it("skips the unlock step when there is no threshold", () => {
    const steps = payoutLadder(0, [{ from: 1, amount: 5 }], { qualified: 2, tiers: [] });
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ isUnlock: false, state: "current", bidders: 2 });
  });
});

describe("thresholdPercent", () => {
  it("clamps to 0–100", () => {
    expect(thresholdPercent(5, 10)).toBe(50);
    expect(thresholdPercent(20, 10)).toBe(100);
    expect(thresholdPercent(3, 0)).toBe(100);
  });
});

describe("stepRangeLabel", () => {
  it("formats ranges", () => {
    expect(stepRangeLabel({ from: 11, to: 25 })).toBe("11–25");
    expect(stepRangeLabel({ from: 51, to: null })).toBe("51+");
    expect(stepRangeLabel({ from: 7, to: 7 })).toBe("7");
  });
});

describe("telegramShareUrl", () => {
  it("encodes the link and message", () => {
    const url = new URL(telegramShareUrl("https://carramarket.com/?ref=ABEBE1", "Join me & win"));
    expect(url.origin + url.pathname).toBe("https://t.me/share/url");
    expect(url.searchParams.get("url")).toBe("https://carramarket.com/?ref=ABEBE1");
    expect(url.searchParams.get("text")).toBe("Join me & win");
  });
});
