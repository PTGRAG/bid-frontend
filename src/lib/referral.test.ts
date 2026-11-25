import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PENDING_REFERRAL_TTL_MS,
  clearPendingReferral,
  getPendingReferral,
  getReferralVisitorId,
  normalizeReferralCode,
  referralCodeFromSearch,
  referralCodeFromStartParam,
  rememberReferral,
  shouldRecordReferralVisit,
} from "./referral";
import { extractAuctionIdFromStartParam } from "./telegram-webapp";

// Node 25 ships its own (disabled) localStorage global that shadows jsdom's, so give each
// test a plain in-memory Storage.
class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  key(i: number) {
    return Array.from(this.m.keys())[i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.stubGlobal("sessionStorage", new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeReferralCode", () => {
  it("uppercases and trims", () => {
    expect(normalizeReferralCode("  abebe10 ")).toBe("ABEBE10");
  });

  it("rejects codes the backend would reject", () => {
    expect(normalizeReferralCode("abc")).toBeNull(); // too short
    expect(normalizeReferralCode("A".repeat(21))).toBeNull(); // too long
    expect(normalizeReferralCode("-ABCD")).toBeNull(); // must start with a letter or digit
    expect(normalizeReferralCode("AB CD")).toBeNull();
    expect(normalizeReferralCode(undefined)).toBeNull();
  });

  it("allows dashes and underscores after the first character", () => {
    expect(normalizeReferralCode("addis_bole-1")).toBe("ADDIS_BOLE-1");
  });
});

describe("reading codes from links", () => {
  it("reads ?ref=", () => {
    expect(referralCodeFromSearch("?ref=kq7m2p&utm_source=tg")).toBe("KQ7M2P");
    expect(referralCodeFromSearch("?utm_source=tg")).toBeNull();
    expect(referralCodeFromSearch(new URLSearchParams("ref=x"))).toBeNull();
  });

  it("reads a Telegram ref_ start param", () => {
    expect(referralCodeFromStartParam("ref_KQ7M2P")).toBe("KQ7M2P");
    expect(referralCodeFromStartParam("auction_6ed3fc7e")).toBeNull();
    expect(referralCodeFromStartParam(null)).toBeNull();
  });

  it("does not treat a referral start param as an auction id", () => {
    expect(extractAuctionIdFromStartParam("ref_KQ7M2P")).toBeNull();
    expect(extractAuctionIdFromStartParam("auction_abc")).toBe("abc");
    expect(extractAuctionIdFromStartParam("6ed3fc7e")).toBe("6ed3fc7e");
  });
});

describe("pending referral", () => {
  it("keeps the first code until it is claimed", () => {
    expect(rememberReferral("FIRST1", 1_000)).toBe("FIRST1");
    expect(rememberReferral("SECOND", 2_000)).toBe("FIRST1");
    expect(getPendingReferral(3_000)).toEqual({ code: "FIRST1", capturedAt: 1_000 });

    clearPendingReferral();
    expect(getPendingReferral(3_000)).toBeNull();
    expect(rememberReferral("SECOND", 4_000)).toBe("SECOND");
  });

  it("expires after the TTL so a newer link can take over", () => {
    rememberReferral("OLDCODE", 0);
    const later = PENDING_REFERRAL_TTL_MS + 1;
    expect(getPendingReferral(later)).toBeNull();
    expect(rememberReferral("NEWCODE", later)).toBe("NEWCODE");
  });

  it("ignores corrupted storage", () => {
    window.localStorage.setItem("carra_ref_pending", "{not json");
    expect(getPendingReferral()).toBeNull();
    window.localStorage.setItem("carra_ref_pending", JSON.stringify({ code: "x", capturedAt: Date.now() }));
    expect(getPendingReferral()).toBeNull();
  });
});

describe("visitor id", () => {
  it("is stable and matches the backend format", () => {
    const id = getReferralVisitorId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(getReferralVisitorId()).toBe(id);
  });

  it("replaces an invalid stored id", () => {
    window.localStorage.setItem("carra_ref_visitor", "bad id!");
    expect(getReferralVisitorId()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});

describe("shouldRecordReferralVisit", () => {
  it("records each code once per tab session", () => {
    expect(shouldRecordReferralVisit("KQ7M2P")).toBe(true);
    expect(shouldRecordReferralVisit("KQ7M2P")).toBe(false);
    expect(shouldRecordReferralVisit("OTHER1")).toBe(true);
  });
});
