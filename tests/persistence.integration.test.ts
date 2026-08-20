import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../src/lib/prisma.ts';
import { createAuctionBid } from '../src/services/auctionBidRepository.ts';
import { createAuctionResult } from '../src/services/auctionResultRepository.ts';
import { createBorrower } from '../src/services/borrowerRepository.ts';
import { createLoanApplication } from '../src/services/loanApplicationRepository.ts';
import { createLoanOutcomeSync } from '../src/services/loanOutcomeSyncRepository.ts';
import { createRiskDecision } from '../src/services/riskDecisionRepository.ts';
import { isLoanApplicationSubmission } from '../src/services/loanApplicationValidation.ts';

const databaseAvailable = Boolean(process.env.DATABASE_URL);
const integrationTest = databaseAvailable ? test : test.skip;

async function cleanup(applicationId: string | undefined, borrowerId: string | undefined): Promise<void> {
  if (applicationId) {
    await prisma.auctionResult.deleteMany({ where: { loanApplicationId: applicationId } });
    await prisma.loanOutcomeSync.deleteMany({ where: { loanApplicationId: applicationId } });
    await prisma.platformLedgerEntry.deleteMany({ where: { loanApplicationId: applicationId } });
    await prisma.auctionBid.deleteMany({ where: { loanApplicationId: applicationId } });
    await prisma.riskDecisionAuditRecord.deleteMany({ where: { loanApplicationId: applicationId } });
    await prisma.loanApplication.delete({ where: { id: applicationId } });
  }
  if (borrowerId) {
    await prisma.borrower.delete({ where: { id: borrowerId } });
  }
}

integrationTest('loan application relations and append-only happy path work', async () => {
  let applicationId: string | undefined;
  let borrowerId: string | undefined;
  try {
    const borrower = await createBorrower('integration-aa-consent');
    borrowerId = borrower.id;
    const application = await createLoanApplication({
      borrowerId: borrower.id,
      requestedAmount: 250000,
      requestedTenureMonths: 36,
      transactionWindowStart: new Date('2026-05-01T00:00:00.000Z'),
      transactionWindowEnd: new Date('2026-07-30T23:59:59.999Z'),
    });
    applicationId = application.id;
    const decision = await createRiskDecision({
      loanApplicationId: application.id,
      rulesVersion: '2026.08.1',
      sriScore: 10,
      sriAction: 'ALLOW_AUCTION',
      flagDetails: [],
    });
    const firstBid = await createAuctionBid({
      loanApplicationId: application.id,
      lenderId: 'lender_01',
      interestRateOffered: 10.25,
      bidReasoning: { source: 'integration-test' },
    });
    const secondBid = await createAuctionBid({
      loanApplicationId: application.id,
      lenderId: 'lender_02',
      interestRateOffered: 10.75,
      bidReasoning: { source: 'integration-test' },
    });
    const result = await createAuctionResult({
      loanApplicationId: application.id,
      winningBidId: firstBid.id,
      finalRate: 10.25,
      selectionReasoning: 'Lowest offered rate.',
    });
    const outcome = await createLoanOutcomeSync({
      loanApplicationId: application.id,
      syncedStatus: 'PENDING_DISBURSEMENT',
      asOfDate: new Date('2026-08-01T00:00:00.000Z'),
      sourceSystem: 'lender-status-feed',
    });
    const loaded = await prisma.loanApplication.findUnique({
      where: { id: application.id },
      include: { borrower: true, riskDecision: true, bids: true, auctionResult: true, outcomeSyncs: true },
    });

    assert.equal(decision.loanApplicationId, application.id);
    assert.equal(secondBid.loanApplicationId, application.id);
    assert.equal(result.winningBidId, firstBid.id);
    assert.equal(outcome.loanApplicationId, application.id);
    assert.equal(loaded?.borrower.id, borrower.id);
    assert.equal(loaded?.riskDecision?.id, decision.id);
    assert.equal(loaded?.bids.length, 2);
    assert.equal(loaded?.auctionResult?.id, result.id);
    assert.equal(loaded?.outcomeSyncs.length, 1);
  } finally {
    await cleanup(applicationId, borrowerId);
  }
});

test('loan application submission without tenure is rejected before persistence', () => {
  assert.equal(isLoanApplicationSubmission({
    amount: 250000,
    lenderId: 'lender_01',
    interestRate: 10.25,
  }), false);
});

integrationTest('append-only repositories expose no update or delete operations', async () => {
  const riskDecisionRepository = await import('../src/services/riskDecisionRepository.ts');
  const auctionBidRepository = await import('../src/services/auctionBidRepository.ts');
  const outcomeRepository = await import('../src/services/loanOutcomeSyncRepository.ts');

  assert.equal('update' in riskDecisionRepository, false);
  assert.equal('delete' in riskDecisionRepository, false);
  assert.equal('update' in auctionBidRepository, false);
  assert.equal('delete' in auctionBidRepository, false);
  assert.equal('update' in outcomeRepository, false);
  assert.equal('delete' in outcomeRepository, false);
});
