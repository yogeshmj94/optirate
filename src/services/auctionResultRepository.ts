import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.ts';

export type AuctionResultRecord = Prisma.AuctionResultGetPayload<{}>;

export interface CreateAuctionResultInput {
  loanApplicationId: string;
  winningBidId: string;
  finalRate: Prisma.Decimal | Prisma.DecimalJsLike | number | string;
  selectionReasoning: string;
}

export function createAuctionResult(input: CreateAuctionResultInput): Promise<AuctionResultRecord> {
  return prisma.auctionResult.create({ data: input });
}
