import { ApplicationStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.ts';

export type LoanApplicationRecord = Prisma.LoanApplicationGetPayload<{}>;

export interface CreateLoanApplicationInput {
  borrowerId: string;
  completionRequestId?: string;
  requestedAmount: Prisma.Decimal | Prisma.DecimalJsLike | number | string;
  requestedTenureMonths: number;
  transactionWindowStart: Date;
  transactionWindowEnd: Date;
  status?: ApplicationStatus;
}

export function createLoanApplication(input: CreateLoanApplicationInput): Promise<LoanApplicationRecord> {
  return prisma.loanApplication.create({
    data: {
      completionRequestId: input.completionRequestId,
      requestedAmount: input.requestedAmount,
      requestedTenureMonths: input.requestedTenureMonths,
      transactionWindowStart: input.transactionWindowStart,
      transactionWindowEnd: input.transactionWindowEnd,
      status: input.status,
      borrower: { connect: { id: input.borrowerId } },
    },
  });
}

export function getLoanApplicationById(id: string): Promise<LoanApplicationRecord | null> {
  return prisma.loanApplication.findUnique({ where: { id } });
}
