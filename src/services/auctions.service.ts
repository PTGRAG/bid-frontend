import { apiFetch, type ApiResponse } from "@/lib/api";
import {
  AuctionAuditSchema,
  AuctionParticipationSchema,
  AuctionSchema,
  PublicAuctionCardSchema,
  PublicAuctionsListSchema,
  BidSchema,
  type Auction,
  type AuctionAudit,
  type AuctionAuditEntry,
  type AuctionParticipation,
  type Bid,
  type MyAuctionResult,
  type PublicAuctionCard,
  type PublicAuctionsList,
} from "@/lib/schemas";

export type {
  MyAuctionResult,
  Auction,
  AuctionAudit,
  AuctionAuditEntry,
  AuctionParticipation,
  Bid,
  PublicAuctionCard,
  PublicAuctionsList,
};

function unwrapData(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: unknown }).data;
  }
  return payload;
}

/** Public list  strips any bid fields that may appear in the payload. */
export async function listAuctions(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  sort?: string;
}): Promise<PublicAuctionsList> {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 12;
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (params?.status && params.status !== "all") {
    qs.set("status", params.status);
  }
  if (params?.search && params.search.trim() !== "") {
    qs.set("search", params.search.trim());
  }
  if (params?.sort && params.sort.trim() !== "") {
    qs.set("sort", params.sort.trim());
  }
  const res = await apiFetch<ApiResponse<unknown>>(
    `/api/public/auctions?${qs.toString()}`
  );
  const raw = unwrapData(res) ?? res.data ?? res;
  const parsed = PublicAuctionsListSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  if (Array.isArray(raw)) {
    return {
      items: raw
        .map((item) => PublicAuctionCardSchema.safeParse(item))
        .filter((r) => r.success)
        .map((r) => r.data),
      total: raw.length,
      page,
      limit,
      totalPages: 1,
      hasMore: false,
      statusCounts: {},
    };
  }
  return {
    items: [],
    total: 0,
    page,
    limit,
    totalPages: 0,
    hasMore: false,
    statusCounts: {},
  };
}

export async function getAuction(id: string): Promise<Auction> {
  const res = await apiFetch<ApiResponse<unknown>>(`/api/public/auctions/${id}`);
  const raw = unwrapData(res) ?? res.data ?? res;
  return AuctionSchema.parse(raw);
}

export async function getAuctionAudit(auctionId: string): Promise<AuctionAudit> {
  const res = await apiFetch<ApiResponse<unknown>>(
    `/api/public/auctions/${auctionId}/audit`
  );
  const raw = unwrapData(res) ?? res.data ?? res;
  return AuctionAuditSchema.parse(raw);
}

export interface ParticipateResult {
  checkoutUrl?: string;
  txRef?: string;
  participating?: boolean;
  participation?: AuctionParticipation;
  bid?: Bid;
  bids?: Bid[];
  /** True when the first ticket's entrance fee was waived (free entrance). */
  entranceWaived?: boolean;
  /** Set when a single free ticket was issued without Chapa (nothing to pay). */
  verified?: boolean;
  amount?: number | string;
  message?: string;
}

export interface VerifyPaymentResult {
  verified: boolean;
  status?: string;
  txRef?: string;
  auctionId?: string;
  participating?: boolean;
  participation?: AuctionParticipation;
  bids?: Bid[];
  /** "entry" (tickets) or "winner" (the winner paying their bid). */
  purpose?: string;
  myResult?: MyAuctionResult | null;
}

/**
 * Buy tickets for a bid pack: each ticket costs the entrance fee only. The bid amount is never
 * charged here; only the winner pays it after the draw (see payWinningBid).
 * With free entrance the first ticket's fee is waived; one free ticket needs no Chapa checkout.
 */
export async function participateInAuction(
  auctionId: string,
  options?: {
    bidValue?: number;
    bidValues?: number[];
    returnUrl?: string;
    checkoutUrl?: string;
    /**
     * Set when the UI quoted a waived entrance fee. If the server can no longer honour it
     * (slot taken / promo off) it answers 409 instead of silently charging more.
     */
    expectEntranceFree?: boolean;
    /**
     * How many near-miss free bids the UI applied to the quote. If fewer are available the
     * server answers 409 instead of charging more.
     */
    expectFreeBids?: number;
  }
): Promise<ParticipateResult> {
  const body: Record<string, unknown> = {};
  if (options?.bidValues && options.bidValues.length > 0) {
    body.bidValues = options.bidValues;
  } else if (options?.bidValue && options.bidValue > 0) {
    body.bidValue = options.bidValue;
  }
  if (options?.returnUrl) body.returnUrl = options.returnUrl;
  if (options?.checkoutUrl) body.checkoutUrl = options.checkoutUrl;
  if (options?.expectEntranceFree) body.expectEntranceFree = true;
  if (options?.expectFreeBids && options.expectFreeBids > 0) {
    body.expectFreeBids = options.expectFreeBids;
  }

  const res = await apiFetch<ApiResponse<ParticipateResult>>(
    `/api/public/auctions/${auctionId}/participate`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
  return (res.data ?? res) as ParticipateResult;
}

export type FreeBidGrant = {
  id: string;
  auctionId?: string;
  auctionTitle?: string;
  reason: "runner_up" | "duplicate_knockout" | "staff_grant";
  rank?: number;
  bidValue?: string | number;
  createdAt: string;
};

export type FreeBidBalance = {
  available: number;
  earned: number;
  used: number;
  recent: FreeBidGrant[];
};

/**
 * Near-miss free bids of the signed-in customer. Each free bid covers one ticket's entrance fee
 * at checkout; if that ticket wins, the bid amount is still paid as usual.
 */
export async function getMyFreeBids(): Promise<FreeBidBalance> {
  const res = await apiFetch<ApiResponse<FreeBidBalance>>("/api/public/free-bids/me");
  const data = (res.data ?? res) as FreeBidBalance;
  return {
    available: Number(data?.available ?? 0),
    earned: Number(data?.earned ?? 0),
    used: Number(data?.used ?? 0),
    recent: Array.isArray(data?.recent) ? data.recent : [],
  };
}

/** Number of free bids a checkout of ticketCount tickets uses. Mirrors domain.FreeBidsApplicable. */
export function freeBidsApplicable(balance: number, ticketCount: number, waiveFirst: boolean): number {
  const payable = Math.max(ticketCount - (waiveFirst ? 1 : 0), 0);
  return Math.max(Math.min(balance, payable), 0);
}

/** Verify Chapa transaction after return from checkout. */
// The server places exactly the bids that were paid for at checkout, so only the
// transaction reference is sent here.
export async function verifyChapaPayment(
  txRef: string,
  signal?: AbortSignal
): Promise<VerifyPaymentResult> {
  const res = await apiFetch<ApiResponse<VerifyPaymentResult>>(
    `/api/public/payments/verify`,
    {
      method: "POST",
      body: JSON.stringify({ txRef }),
      signal,
    }
  );
  return (res.data ?? res) as VerifyPaymentResult;
}

export async function updateBid(
  bidId: string,
  newBidValue: number
): Promise<Bid> {
  const res = await apiFetch<ApiResponse<unknown>>(`/api/public/bids/${bidId}`, {
    method: "PATCH",
    body: JSON.stringify({ newBidValue }),
  });
  const raw = unwrapData(res) ?? res.data ?? res;
  return BidSchema.parse(raw);
}

export async function getMyBids(auctionId: string): Promise<Bid[]> {
  const res = await apiFetch<ApiResponse<unknown>>(
    `/api/public/auctions/${auctionId}/my-bids`
  );
  const raw = unwrapData(res) ?? res.data ?? res;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => BidSchema.safeParse(item))
      .filter((r) => r.success)
      .map((r) => r.data);
  }
  return [];
}

export async function getMyParticipation(
  auctionId: string
): Promise<{ participating: boolean; participation?: AuctionParticipation }> {
  const res = await apiFetch<ApiResponse<unknown>>(
    `/api/public/auctions/${auctionId}/my-participation`
  );
  const raw = (unwrapData(res) ?? res.data ?? res) as Record<string, unknown>;
  if (raw && typeof raw === "object") {
    const participating = Boolean(raw.participating);
    let participation: AuctionParticipation | undefined;
    if (raw.participation) {
      const parsed = AuctionParticipationSchema.safeParse(raw.participation);
      if (parsed.success) participation = parsed.data;
    }
    return { participating, participation };
  }
  return { participating: false };
}

export async function listMyParticipations(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  items: Array<{
    auction: Auction;
    participation: AuctionParticipation;
    bids?: Bid[];
  }>;
  total: number;
}> {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  try {
    const res = await apiFetch<ApiResponse<unknown>>(
      `/api/me/participations?${qs.toString()}`
    );
    const raw = (unwrapData(res) ?? res.data ?? res) as {
      items?: unknown[];
      total?: number;
    };
    const items = Array.isArray(raw?.items)
      ? raw.items
          .map((row) => {
            const r = row as Record<string, unknown>;
            const auction = AuctionSchema.safeParse(r.auction ?? r);
            const participation = AuctionParticipationSchema.safeParse(
              r.participation ?? r
            );
            if (!auction.success || !participation.success) return null;
            return {
              auction: auction.data,
              participation: participation.data,
              bids: Array.isArray(r.bids)
                ? r.bids
                    .map((b) => BidSchema.safeParse(b))
                    .filter((x) => x.success)
                    .map((x) => x.data)
                : undefined,
            };
          })
          .filter(Boolean) as Array<{
          auction: Auction;
          participation: AuctionParticipation;
          bids?: Bid[];
        }>
      : [];
    return { items, total: raw?.total ?? items.length };
  } catch {
    return { items: [], total: 0 };
  }
}

export interface WinnerPaymentStart {
  checkoutUrl: string;
  txRef: string;
  amount?: number | string;
  dueAt?: string;
}

/** Start the Chapa checkout for the signed-in winner's bid amount (server sets the amount). */
export async function payWinningBid(
  auctionId: string,
  returnUrl?: string
): Promise<WinnerPaymentStart> {
  const res = await apiFetch<ApiResponse<WinnerPaymentStart>>(
    `/api/public/auctions/${auctionId}/winner-payment`,
    {
      method: "POST",
      body: JSON.stringify(returnUrl ? { returnUrl } : {}),
    }
  );
  return (res.data ?? res) as WinnerPaymentStart;
}
