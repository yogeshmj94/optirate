import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.ts';

export type PlatformLedgerEntryRecord = Prisma.PlatformLedgerEntryGetPayload<{}>;

export interface CreatePlatformLedgerEntryInput {
  loanApplicationId: string;
  entryType: string;
  amount: Prisma.Decimal | Prisma.DecimalJsLike | number | string;
  direction: string;
}

export function createPlatformLedgerEntry(input: CreatePlatformLedgerEntryInput): Promise<PlatformLedgerEntryRecord> {
  return prisma.platformLedgerEntry.create({ data: input });
}
