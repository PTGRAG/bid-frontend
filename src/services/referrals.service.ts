import { apiFetch, type ApiResponse } from "@/lib/api";

// ---- Shared shapes (mirror bid-backend core/services/referral) ----

export type ReferralKind = "agent" | "influencer";
export type ReferralCodeStatus = "active" | "paused";
export type ReferralStatus = "signed_up" | "qualified" | "rejected";

export interface ReferralTier {
  from: number;
  /** Omitted on the last, open-ended tier. */
  to?: number | null;
  amount: number;
}

export interface ReferralTierProgress extends ReferralTier {
  bidders: number;
  subtotal: number;
}

export interface ReferralEarnings {
  qualified: number;
  threshold: number;
  unlocked: boolean;
  remaining: number;
  earned: number;
  currentRate: number;
  nextTier?: { from: number; amount: number; biddersNeeded: number };
  tiers: ReferralTierProgress[];
}

export interface ReferralEarningsView extends ReferralEarnings {
  paidOut: number;
  owed: number;
  overpaid: number;
}

export interface AuctionRef {
  id: string;
  title: string;
}

export interface ReferralProgram {
  id: string;
  name: string;
  kind: ReferralKind;
  isDefault: boolean;
  threshold: number;
  tiers: ReferralTier[];
  attributionWindowDays: number;
  qualifyingAuctions: AuctionRef[];
}

export interface ReferralProgramAdmin extends ReferralProgram {
  netMarginPerBid: number;
  topTierAmount: number;
  lowestEntranceFee?: number;
  warnings: string[];
}

export type PayoutMethod = "telebirr" | "cbe_birr" | "mpesa" | "bank";

/** Where a code owner wants to be paid. Mobile money accounts are phone numbers (2519…). */
export interface PayoutAccount {
  method: PayoutMethod | string;
  bank?: string;
  account: string;
  name: string;
}

export interface ReferralCodeView {
  id: string;
  code: string;
  kind: ReferralKind;
  label: string;
  status: ReferralCodeStatus;
  link: string;
  createdAt: string;
  /** The owner became an agent from the app (not created by staff). */
  selfSignup?: boolean;
  /** Null until the owner adds a payout account. */
  payout?: PayoutAccount | null;
}

export interface ReferralFunnel {
  visitors: number;
  visits: number;
  signups: number;
  pending: number;
  qualified: number;
  rejected: number;
  /** Percent (0–100, one decimal). */
  visitorToSignupRate: number;
  /** Percent (0–100, one decimal). */
  signupToQualifiedRate: number;
}

export interface ReferralCodeSummary {
  code: ReferralCodeView;
  program: ReferralProgram;
  funnel: ReferralFunnel;
  earnings: ReferralEarningsView;
}

export interface ReferralCodeDetail extends ReferralCodeSummary {
  ownerUserId?: string;
  ownerName: string;
  ownerPhone: string;
}

export interface ReferralView {
  id: string;
  code: string;
  name: string;
  phone: string;
  status: ReferralStatus;
  signedUpAt: string;
  qualifiedAt?: string;
  qualifiesBy?: string;
  expired?: boolean;
  needsPhone: boolean;
  auctionTitle?: string;
  rejectReason?: string;
  rejectNote?: string;
  userId?: string;
  /** Other accounts referred by the same code from the same browser (staff only). */
  sameDevice?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ReferralDailyCount {
  day: string;
  visitors: number;
  signups: number;
  qualified: number;
}

export interface ReferralPayout {
  id: string;
  codeId: string;
  amount: number;
  method: string;
  reference: string;
  note: string;
  paidAt: string;
  createdAt: string;
}

export interface ReferralCodeListItem {
  id: string;
  code: string;
  kind: ReferralKind;
  label: string;
  status: ReferralCodeStatus;
  ownerUserId?: string;
  programId?: string;
  createdAt: string;
  ownerName: string;
  ownerPhone: string;
  selfSignup?: boolean;
  payoutMethod?: string;
  payoutBank?: string;
  payoutAccount?: string;
  payoutName?: string;
  visitors: number;
  visits: number;
  signups: number;
  pending: number;
  qualified: number;
  rejected: number;
  paidOut: number;
  link: string;
  threshold: number;
  unlocked: boolean;
  earned: number;
  owed: number;
}

// ---- Public / participant ----

export interface PublicReferralCode {
  code: string;
  kind: ReferralKind;
  invitedBy: string;
}

export type ReferralClaimReason =
  | "already_referred"
  | "existing_account"
  | "existing_customer"
  | "not_participant";

export interface ReferralClaimResult {
  attributed: boolean;
  code: string;
  reason?: ReferralClaimReason | string;
}

export interface AgentReferralDashboard {
  isReferrer: boolean;
  codes: ReferralCodeSummary[];
  totals: { funnel: ReferralFunnel; earned: number; paidOut: number; owed: number };
}

const enc = encodeURIComponent;

function qs(params: Record<string, string | number | undefined | null>): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    out.set(k, String(v));
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

async function data<T>(p: Promise<ApiResponse<T>>): Promise<T> {
  return (await p).data;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export function lookupReferralCode(code: string): Promise<PublicReferralCode> {
  return data(apiFetch(`/api/public/referrals/${enc(code)}`, { skipAuthRedirect: true }));
}

export function recordReferralVisit(
  code: string,
  visitorId: string,
  landingPath?: string
): Promise<PublicReferralCode> {
  return data(
    apiFetch(`/api/public/referrals/${enc(code)}/click`, {
      method: "POST",
      skipAuthRedirect: true,
      ...json({ visitorId, landingPath: landingPath?.slice(0, 255) }),
    })
  );
}

export function claimReferral(code: string, visitorId?: string): Promise<ReferralClaimResult> {
  return data(
    apiFetch("/api/referrals/claim", {
      method: "POST",
      skipAuthRedirect: true,
      ...json({ code, visitorId }),
    })
  );
}

export function getMyReferralDashboard(): Promise<AgentReferralDashboard> {
  return data(apiFetch("/api/referrals/me"));
}

export function getMyReferrals(params: {
  status?: string;
  page?: number;
  limit?: number;
  codeId?: string;
} = {}): Promise<Paged<ReferralView>> {
  return data(apiFetch(`/api/referrals/me/referrals${qs(params)}`));
}

export function getMyReferralActivity(params: { days?: number; codeId?: string } = {}): Promise<ReferralDailyCount[]> {
  return data(apiFetch(`/api/referrals/me/activity${qs(params)}`));
}

export function getMyReferralPayouts(): Promise<ReferralPayout[]> {
  return data(apiFetch("/api/referrals/me/payouts"));
}

// ---- Self-serve agents ----

export type AgentJoinReason =
  | "signup_closed"
  | "not_participant"
  | "account_inactive"
  | "needs_phone"
  | "phone_taken"
  | "agent_paused";

export interface AgentJoinInfo {
  open: boolean;
  isAgent: boolean;
  canJoin: boolean;
  reason?: AgentJoinReason | string;
  hasPhone: boolean;
  /** Masked. */
  phone?: string;
  fullName: string;
  /** The default agent program a new agent joins. */
  program: ReferralProgram;
}

/** Public: whether agent signup is open and the deal a new agent gets. */
export function getPublicAgentProgram(): Promise<{ open: boolean; program: ReferralProgram }> {
  return data(apiFetch("/api/public/agent-program", { skipAuthRedirect: true }));
}

export function getAgentJoinInfo(): Promise<AgentJoinInfo> {
  return data(apiFetch("/api/referrals/agent"));
}

/** Become an agent. `phone` and `verificationToken` are only needed when the account has no phone. */
export function joinAsAgent(input: {
  acceptTerms: boolean;
  phone?: string;
  verificationToken?: string;
}): Promise<AgentReferralDashboard> {
  return data(apiFetch("/api/referrals/agent", { method: "POST", ...json(input) }));
}

export function setMyPayoutAccount(input: PayoutAccount, codeId?: string): Promise<PayoutAccount> {
  return data(apiFetch(`/api/referrals/me/payout-account${qs({ codeId })}`, { method: "PUT", ...json(input) }));
}

// ---- Staff ----

export interface ReferralSettings {
  agentSignupOpen: boolean;
  updatedAt?: string;
}

export function getReferralSettings(): Promise<ReferralSettings> {
  return data(apiFetch("/api/referral-settings"));
}

export function updateReferralSettings(input: Partial<ReferralSettings>): Promise<ReferralSettings> {
  return data(apiFetch("/api/referral-settings", { method: "PUT", ...json(input) }));
}

export interface ReferralProgramInput {
  name?: string;
  kind?: ReferralKind;
  threshold?: number;
  tiers?: ReferralTier[];
  netMarginPerBid?: number;
  qualifyingAuctionIds?: string[];
  attributionWindowDays?: number;
}

export interface ReferralCodeInput {
  kind?: ReferralKind;
  ownerPhone?: string;
  code?: string;
  label?: string;
  programId?: string | null;
  clearProgram?: boolean;
  status?: ReferralCodeStatus;
}

export interface ReferralPayoutInput {
  amount: number;
  method?: string;
  reference?: string;
  note?: string;
}

export function listReferralPrograms(): Promise<ReferralProgramAdmin[]> {
  return data(apiFetch("/api/referral-programs"));
}

export function createReferralProgram(input: ReferralProgramInput): Promise<ReferralProgramAdmin> {
  return data(apiFetch("/api/referral-programs", { method: "POST", ...json(input) }));
}

export function updateReferralProgram(id: string, input: ReferralProgramInput): Promise<ReferralProgramAdmin> {
  return data(apiFetch(`/api/referral-programs/${enc(id)}`, { method: "PATCH", ...json(input) }));
}

export function listReferralCodes(params: {
  kind?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paged<ReferralCodeListItem>> {
  return data(apiFetch(`/api/referral-codes${qs(params)}`));
}

export function createReferralCode(input: ReferralCodeInput): Promise<ReferralCodeDetail> {
  return data(apiFetch("/api/referral-codes", { method: "POST", ...json(input) }));
}

export function getReferralCode(id: string): Promise<ReferralCodeDetail> {
  return data(apiFetch(`/api/referral-codes/${enc(id)}`));
}

export function updateReferralCode(id: string, input: ReferralCodeInput): Promise<ReferralCodeDetail> {
  return data(apiFetch(`/api/referral-codes/${enc(id)}`, { method: "PATCH", ...json(input) }));
}

export function getReferralCodeReferrals(
  id: string,
  params: { status?: string; page?: number; limit?: number } = {}
): Promise<Paged<ReferralView>> {
  return data(apiFetch(`/api/referral-codes/${enc(id)}/referrals${qs(params)}`));
}

export function getReferralCodeActivity(id: string, days = 30): Promise<ReferralDailyCount[]> {
  return data(apiFetch(`/api/referral-codes/${enc(id)}/activity${qs({ days })}`));
}

export function getReferralCodePayouts(id: string): Promise<ReferralPayout[]> {
  return data(apiFetch(`/api/referral-codes/${enc(id)}/payouts`));
}

export function addReferralPayout(id: string, input: ReferralPayoutInput): Promise<ReferralPayout> {
  return data(apiFetch(`/api/referral-codes/${enc(id)}/payouts`, { method: "POST", ...json(input) }));
}

export function rejectReferral(attributionId: string, note?: string): Promise<unknown> {
  return data(
    apiFetch(`/api/referral-attributions/${enc(attributionId)}/reject`, { method: "POST", ...json({ note }) })
  );
}

export function restoreReferral(attributionId: string): Promise<unknown> {
  return data(apiFetch(`/api/referral-attributions/${enc(attributionId)}/restore`, { method: "POST", ...json({}) }));
}

export function runReferralSweep(): Promise<{ qualified: number; rejected: number }> {
  return data(apiFetch("/api/referrals/sweep", { method: "POST", ...json({}) }));
}

export const REFERRAL_REJECT_REASON_LABEL: Record<string, string> = {
  self_referral: "Own code",
  duplicate_phone: "Phone already counted",
  duplicate_payment_account: "Payment account already counted",
  rejected_by_staff: "Rejected by staff",
};
