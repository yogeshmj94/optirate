import { NextResponse } from 'next/server';
import { createAuctionBid } from '@/services/auctionBidRepository';
import { createAuctionResult } from '@/services/auctionResultRepository';
import { createBorrower } from '@/services/borrowerRepository';
import { createLoanApplication } from '@/services/loanApplicationRepository';
import { isLoanApplicationSubmission } from '@/services/loanApplicationValidation';

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isLoanApplicationSubmission(body)) {
      return NextResponse.json({ error: 'Invalid loan application details' }, { status: 400 });
    }

    const borrower = await createBorrower(body.aaConsentId || `ui-consent-${Date.now()}`);
    const now = new Date();
    const application = await createLoanApplication({
      borrowerId: body.borrowerId || borrower.id,
      requestedAmount: body.amount,
      requestedTenureMonths: body.tenureMonths,
      transactionWindowStart: new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)),
      transactionWindowEnd: now,
      status: 'FUNDED',
    });
    const bid = await createAuctionBid({
      loanApplicationId: application.id,
      lenderId: body.lenderId,
      interestRateOffered: body.interestRate,
      bidReasoning: { source: 'selected-auction-bid', tenureMonths: body.tenureMonths },
      bidStatus: 'WON',
    });
    await createAuctionResult({
      loanApplicationId: application.id,
      winningBidId: bid.id,
      finalRate: body.interestRate,
      selectionReasoning: 'Borrower selected the winning marketplace bid.',
    });

    return NextResponse.json({
      success: true,
      applicationId: application.id,
      message: 'Application and auction outcome recorded. The lender remains responsible for disbursement and repayment records.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to record loan application';
    console.error('Application completion error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
