import { describe, expect, it } from "vitest";
import { freeBidsApplicable } from "./auctions.service";

describe("freeBidsApplicable (mirrors domain.FreeBidsApplicable)", () => {
  it("covers paid tickets up to the balance", () => {
    expect(freeBidsApplicable(0, 3, false)).toBe(0);
    expect(freeBidsApplicable(5, 3, false)).toBe(3);
    expect(freeBidsApplicable(2, 4, false)).toBe(2);
  });

  it("never spends a free bid on the free-entrance ticket", () => {
    expect(freeBidsApplicable(5, 3, true)).toBe(2);
    expect(freeBidsApplicable(1, 1, true)).toBe(0);
  });
});
