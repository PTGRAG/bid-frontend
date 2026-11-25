/**
 * Referral link capture.
 *
 * An agent shares `https://carramarket.com/?ref=CODE` (or the Telegram mini app with
 * `startapp=ref_CODE`). We remember the code on this device so it survives the trip through
 * signup, record the visit for the agent's funnel, and claim it once the visitor has an
 * account. The backend decides whether the claim counts; this file only carries the code.
 */

export const REFERRAL_QUERY_PARAM = "ref";
export const TELEGRAM_REFERRAL_PREFIX = "ref_";

/** How long an unclaimed code stays on the device. */
export const PENDING_REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const VISITOR_KEY = "carra_ref_visitor";
const PENDING_KEY = "carra_ref_pending";
const CLICK_SENT_KEY = "carra_ref_click_sent";

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{3,19}$/;
const VISITOR_RE = /^[A-Za-z0-9_-]{8,64}$/;

export interface PendingReferral {
  code: string;
  capturedAt: number;
}

/** Uppercases and validates a code the same way the backend does. Returns null when invalid. */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** Reads `?ref=CODE` from a query string. */
export function referralCodeFromSearch(search: string | URLSearchParams | null | undefined): string | null {
  if (!search) return null;
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  return normalizeReferralCode(params.get(REFERRAL_QUERY_PARAM));
}

/** Reads `ref_CODE` from a Telegram mini app start_param. */
export function referralCodeFromStartParam(param: string | null | undefined): string | null {
  if (!param) return null;
  const trimmed = param.trim();
  if (!trimmed.toLowerCase().startsWith(TELEGRAM_REFERRAL_PREFIX)) return null;
  return normalizeReferralCode(trimmed.slice(TELEGRAM_REFERRAL_PREFIX.length));
}

function storage(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replace(/-/g, "");
    }
  } catch {
    /* fall through */
  }
  let out = "";
  while (out.length < 32) out += Math.random().toString(36).slice(2);
  return out.slice(0, 32);
}

/**
 * A stable, anonymous id for this browser. The backend uses it to count unique visitors per
 * link and to flag several signups from one device. It is not tied to any personal data.
 */
export function getReferralVisitorId(): string {
  const ls = storage("local");
  try {
    const existing = ls?.getItem(VISITOR_KEY);
    if (existing && VISITOR_RE.test(existing)) return existing;
  } catch {
    /* ignore */
  }
  const id = randomId();
  try {
    ls?.setItem(VISITOR_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}

export function getPendingReferral(now: number = Date.now()): PendingReferral | null {
  const ls = storage("local");
  if (!ls) return null;
  try {
    const raw = ls.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingReferral>;
    const code = normalizeReferralCode(parsed.code);
    const capturedAt = typeof parsed.capturedAt === "number" ? parsed.capturedAt : NaN;
    if (!code || !Number.isFinite(capturedAt) || now - capturedAt > PENDING_REFERRAL_TTL_MS) {
      ls.removeItem(PENDING_KEY);
      return null;
    }
    return { code, capturedAt };
  } catch {
    return null;
  }
}

/**
 * Stores a code for claiming after signup. The first link a visitor opens wins: a later
 * link does not replace a code that is still valid, which matches the backend's rule that an
 * account is credited to the first agent who brought it in.
 *
 * Returns the code that is now pending.
 */
export function rememberReferral(code: string, now: number = Date.now()): string {
  const current = getPendingReferral(now);
  if (current) return current.code;
  const ls = storage("local");
  try {
    ls?.setItem(PENDING_KEY, JSON.stringify({ code, capturedAt: now } satisfies PendingReferral));
  } catch {
    /* ignore */
  }
  return code;
}

export function clearPendingReferral(): void {
  try {
    storage("local")?.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * True the first time a code is seen in this browser tab session. Used to avoid recording a
 * visit on every re-render or client-side navigation that keeps `?ref=` in the URL.
 */
export function shouldRecordReferralVisit(code: string): boolean {
  const ss = storage("session");
  if (!ss) return true;
  try {
    const seen = (ss.getItem(CLICK_SENT_KEY) || "").split(",").filter(Boolean);
    if (seen.includes(code)) return false;
    seen.push(code);
    ss.setItem(CLICK_SENT_KEY, seen.slice(-10).join(","));
    return true;
  } catch {
    return true;
  }
}

/**
 * The Telegram mini app version of a referral link, or null when no bot is configured.
 * Opening it starts the app with `ref_CODE`, which ReferralCapture reads like `?ref=`.
 */
export function telegramReferralLink(
  code: string,
  botUsername: string | undefined = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
): string | null {
  const bot = (botUsername || "").trim().replace(/^@/, "");
  if (!bot) return null;
  return `https://t.me/${bot}?startapp=${TELEGRAM_REFERRAL_PREFIX}${encodeURIComponent(code)}`;
}
