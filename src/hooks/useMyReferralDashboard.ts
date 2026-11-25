"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/query-keys";
import { getMyReferralDashboard } from "@/services/referrals.service";

/** The signed-in account's referral codes and earnings. Shared by the navbar and /agent. */
export function useMyReferralDashboard(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.me.referrals(user?.id),
    queryFn: getMyReferralDashboard,
    enabled: enabled && !!user,
    staleTime: 60_000,
  });
}
