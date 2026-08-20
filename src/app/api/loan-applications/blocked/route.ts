import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isBlockedAuctionSubmission } from '@/services/loanApplicationValidation';
import { RULES_VERSION } from '@/services/riskEngine';

export async function POST(request: Request) {
  let completionRequestId: string | undefined;

  try {
    const body: unknown = await request.json();
    if (!isBlockedAuctionSubmission(body)) {
      return NextResponse.json({ error: 'Invalid blocked auction details' }, { status: 400 });
    }
    completionRequestId = body.completionRequestId;

    const application = await prisma.$transaction(async (tx) => {
      const existing = await tx.loanApplication.findUnique({
        where: { completionRequestId: body.completionRequestId },
      });
      if (existing) return existing;

      const borrower = await tx.borrower.create({
        data: { aaConsentId: body.aaConsentId || `ui-consent-${Date.now()}` },
      });
      const now = new Date();
      const applicationRecord = await tx.loanApplication.create({
        data: {
          completionRequestId: body.completionRequestId,
          borrowerId: body.borrowerId || borrower.id,
          requestedAmount: body.amount,
          requestedTenureMonths: body.tenureMonths,
          transactionWindowStart: new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)),
          transactionWindowEnd: now,
          status: 'REJECTED',
        },
      });
      await tx.riskDecisionAuditRecord.create({
        data: {
          loanApplicationId: applicationRecord.id,
          rulesVersion: RULES_VERSION,
          sriScore: body.riskScore,
          sriAction: body.riskAction,
          flagDetails: body.riskReasons,
        },
      });
      await tx.loanOutcomeSync.create({
        data: {
          loanApplicationId: applicationRecord.id,
          syncedStatus: 'AUCTION_BLOCKED',
          asOfDate: now,
          sourceSystem: 'risk-engine',
        },
      });
      return applicationRecord;
    });

    return NextResponse.json({
      success: true,
      applicationId: application.id,
      message: 'Blocked auction decision recorded for audit.',
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && completionRequestId) {
      const existing = await prisma.loanApplication.findUnique({ where: { completionRequestId } });
      if (existing) {
        return NextResponse.json({
          success: true,
          applicationId: existing.id,
          message: 'Blocked auction decision was already recorded for this request.',
        });
      }
    }
    const message = error instanceof Error ? error.message : 'Unable to record blocked auction';
    console.error('Blocked auction recording error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}