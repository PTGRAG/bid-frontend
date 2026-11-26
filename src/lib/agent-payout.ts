/** Display helpers for an agent's payout account (see bid-backend domain.ReferralPayoutAccount). */

import type { PayoutAccount } from "@/services/referrals.service";

export type PayoutMethodKey =
  | "payoutMethodTelebirr"
  | "payoutMethodCbeBirr"
  | "payoutMethodMpesa"
  | "payoutMethodBank";

/** The `agent.*` translation key for a payout method. Unknown methods read as a bank account. */
export function payoutMethodKey(method: string): PayoutMethodKey {
  switch (method) {
    case "telebirr":
      return "payoutMethodTelebirr";
    case "cbe_birr":
      return "payoutMethodCbeBirr";
    case "mpesa":
      return "payoutMethodMpesa";
    default:
      return "payoutMethodBank";
  }
}

/** Plain English method names for staff screens. */
export const PAYOUT_METHOD_LABEL: Record<string, string> = {
  telebirr: "telebirr",
  cbe_birr: "CBE Birr",
  mpesa: "M-Pesa",
  bank: "Bank",
};

/**
 * The account as people read it: "+251 911 223 344" for mobile money (stored as 251911223344),
 * or the bank number in groups of four.
 */
export function formatPayoutAccount(p: Pick<PayoutAccount, "method" | "account">): string {
  const a = (p.account || "").replace(/\D/g, "");
  if (p.method !== "bank" && a.length === 12 && a.startsWith("251")) {
    return `+251 ${a.slice(3, 6)} ${a.slice(6, 9)} ${a.slice(9)}`;
  }
  return a.replace(/(\d{4})(?=\d)/g, "$1 ");
}
