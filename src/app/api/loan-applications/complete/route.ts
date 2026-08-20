import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isLoanApplicationSubmission } from '@/services/loanApplicationValidation';
import { RULES_VERSION } from '@/services/riskEngine';

export async function POST(request: Request) {
  let completionRequestId: string | undefined;
  try {
    const body: unknown = await request.json();
    if (!isLoanApplicationSubmission(body)) {
      return NextResponse.json({ error: 'Invalid loan application details' }, { status: 400 });
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
      const createdApplication = await tx.loanApplication.create({
        data: {
          completionRequestId: body.completionRequestId,
          borrowerId: body.borrowerId || borrower.id,
          requestedAmount: body.amount,
          requestedTenureMonths: body.tenureMonths,
          transactionWindowStart: new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)),
          transactionWindowEnd: now,
          status: 'FUNDED',
        },
      });
      const bid = await tx.auctionBid.create({
        data: {
          loanApplicationId: createdApplication.id,
          lenderId: body.lenderId,
          interestRateOffered: body.interestRate,
          bidReasoning: { source: 'selected-auction-bid', tenureMonths: body.tenureMonths },
          bidStatus: 'WON',
        },
      });
      await tx.auctionResult.create({
        data: {
          loanApplicationId: createdApplication.id,
          winningBidId: bid.id,
          finalRate: body.interestRate,
          selectionReasoning: 'Borrower selected the winning marketplace bid.',
        },
      });
      await tx.riskDecisionAuditRecord.create({
        data: {
          loanApplicationId: createdApplication.id,
          rulesVersion: RULES_VERSION,
          sriScore: body.riskScore ?? 0,
          sriAction: body.riskAction ?? 'ALLOW_AUCTION',
          flagDetails: body.riskReasons ?? [],
        },
      });
      await tx.platformLedgerEntry.create({
        data: {
          loanApplicationId: createdApplication.id,
          entryType: 'DISBURSEMENT',
          amount: body.amount,
          direction: 'CREDIT',
        },
      });
      await tx.loanOutcomeSync.create({
        data: {
          loanApplicationId: createdApplication.id,
          syncedStatus: 'DISBURSED',
          asOfDate: now,
          sourceSystem: 'marketplace-completion',
        },
      });
      return createdApplication;
    });

    return NextResponse.json({
      success: true,
      applicationId: application.id,
      message: 'Application and auction outcome recorded. The lender remains responsible for disbursement and repayment records.',
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      if (completionRequestId) {
        const existing = await prisma.loanApplication.findUnique({
          where: { completionRequestId },
        });
        if (existing) {
          return NextResponse.json({
            success: true,
            applicationId: existing.id,
            message: 'Application was already recorded for this completion request.',
          });
        }
      }
    }
    const message = error instanceof Error ? error.message : 'Unable to record loan application';
    console.error('Application completion error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
