import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.ts';

export type LoanOutcomeSyncRecord = Prisma.LoanOutcomeSyncGetPayload<{}>;

export interface CreateLoanOutcomeSyncInput {
  loanApplicationId: string;
  syncedStatus: string;
  asOfDate: Date;
  sourceSystem: string;
}

// Insert-only external-feed boundary: corrections arrive as another source record, never an update/delete.
export function createLoanOutcomeSync(input: CreateLoanOutcomeSyncInput): Promise<LoanOutcomeSyncRecord> {
  return prisma.loanOutcomeSync.create({ data: input });
}

export function listLoanOutcomeSyncs(loanApplicationId: string): Promise<LoanOutcomeSyncRecord[]> {
  return prisma.loanOutcomeSync.findMany({ where: { loanApplicationId }, orderBy: { asOfDate: 'desc' } });
}
