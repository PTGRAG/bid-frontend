"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPendingReferral, referralCodeFromSearch } from "@/lib/referral";
import { lookupReferralCode } from "@/services/referrals.service";

/** Shows who invited the visitor when a referral code is waiting to be claimed. */
export function InvitedByBanner() {
  const { dict } = useLanguage();
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    // ReferralCapture stores the code on the same render pass, so read the URL too.
    setCode(getPendingReferral()?.code ?? referralCodeFromSearch(window.location.search));
  }, []);

  const query = useQuery({
    queryKey: ["referral", "public", code],
    queryFn: () => lookupReferralCode(code as string),
    enabled: !!code,
    retry: false,
    staleTime: 10 * 60_000,
  });

  if (!code || query.isError) return null;
  const name = query.data?.invitedBy?.trim();
  const text = name
    ? dict.auth.invitedBy.replace("{name}", name)
    : dict.auth.invitedWithCode.replace("{code}", code);

  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm font-semibold text-emerald-900">
      <Gift className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      <span className="min-w-0 truncate">{text}</span>
    </div>
  );
}
