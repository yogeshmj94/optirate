import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.ts';

export type BorrowerRecord = Prisma.BorrowerGetPayload<{}>;

export function createBorrower(aaConsentId: string): Promise<BorrowerRecord> {
  return prisma.borrower.create({ data: { aaConsentId } });
}

export function getBorrowerById(id: string): Promise<BorrowerRecord | null> {
  return prisma.borrower.findUnique({ where: { id } });
}
