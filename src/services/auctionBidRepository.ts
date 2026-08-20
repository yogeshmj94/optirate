import { BidStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.ts';

export type AuctionBidRecord = Prisma.AuctionBidGetPayload<{}>;

export interface CreateAuctionBidInput {
  loanApplicationId: string;
  lenderId: string;
  interestRateOffered: Prisma.Decimal | Prisma.DecimalJsLike | number | string;
  bidReasoning: Prisma.InputJsonValue;
  bidStatus?: BidStatus;
}

// Append-only by design: bids are evidence of a competitive auction and must remain reviewable.
export function createAuctionBid(input: CreateAuctionBidInput): Promise<AuctionBidRecord> {
  return prisma.auctionBid.create({ data: input });
}

export function listAuctionBids(loanApplicationId: string): Promise<AuctionBidRecord[]> {
  return prisma.auctionBid.findMany({ where: { loanApplicationId }, orderBy: { submittedAt: 'asc' } });
}
