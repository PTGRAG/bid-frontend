"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import {
  clearPendingReferral,
  getPendingReferral,
  getReferralVisitorId,
  referralCodeFromSearch,
  referralCodeFromStartParam,
  rememberReferral,
  shouldRecordReferralVisit,
} from "@/lib/referral";
import { getTelegramStartParam } from "@/lib/telegram-webapp";
import { claimReferral, recordReferralVisit } from "@/services/referrals.service";

/**
 * Remembers an agent's referral code from `?ref=CODE` (or a Telegram `ref_CODE` start
 * param), records the visit, and claims the code once the visitor is signed in.
 *
 * Renders nothing. Mounted once inside AuthProvider.
 */
export function ReferralCapture() {
  const searchParams = useSearchParams();
  const pathname = usePathname() || "/";
  const { user, loading } = useAuth();
  const claimingRef = useRef(false);

  // Capture: runs on first load and on client-side navigation to a URL with ?ref=.
  useEffect(() => {
    const code =
      referralCodeFromSearch(searchParams?.toString() ?? "") ??
      referralCodeFromStartParam(getTelegramStartParam());
    if (!code) return;

    rememberReferral(code);
    if (!shouldRecordReferralVisit(code)) return;
    recordReferralVisit(code, getReferralVisitorId(), pathname).catch(() => {
      // An unknown or paused code is not worth bothering the visitor about.
    });
  }, [searchParams, pathname]);

  // Claim: once a participant is signed in and a code is waiting on this device.
  useEffect(() => {
    if (loading || !user || claimingRef.current) return;
    const role = String(user.role || "participant").toLowerCase();
    if (role !== "participant") {
      clearPendingReferral();
      return;
    }
    const pending = getPendingReferral();
    if (!pending) return;

    claimingRef.current = true;
    claimReferral(pending.code, getReferralVisitorId())
      .then(() => clearPendingReferral())
      .catch((err: unknown) => {
        // The server answered (unknown code, bad request): retrying will not help.
        // Network or server errors keep the code for the next page load.
        if (err instanceof ApiError && err.status < 500) clearPendingReferral();
      })
      .finally(() => {
        claimingRef.current = false;
      });
  }, [user, loading, searchParams]);

  return null;
}
