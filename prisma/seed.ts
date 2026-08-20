import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Development-only seed data. Never use these records as production fixtures.
  const borrower = await prisma.borrower.create({ data: { aaConsentId: 'dev-aa-consent-001' } });
  const application = await prisma.loanApplication.create({
    data: {
      borrowerId: borrower.id,
      requestedAmount: '250000',
      requestedTenureMonths: 36,
      status: 'AUCTION_CLOSED',
      transactionWindowStart: new Date('2026-05-01T00:00:00.000Z'),
      transactionWindowEnd: new Date('2026-07-30T23:59:59.999Z'),
    },
  });
  await prisma.riskDecisionAuditRecord.create({
    data: {
      loanApplicationId: application.id,
      rulesVersion: '2026.08.1',
      sriScore: 12,
      sriAction: 'ALLOW_AUCTION',
      flagDetails: [],
    },
  });
  const firstBid = await prisma.auctionBid.create({
    data: {
      loanApplicationId: application.id,
      lenderId: 'lender_01',
      interestRateOffered: '10.25',
      bidReasoning: { note: 'Lowest risk-adjusted offer' },
      bidStatus: 'WON',
    },
  });
  await prisma.auctionBid.create({
    data: {
      loanApplicationId: application.id,
      lenderId: 'lender_02',
      interestRateOffered: '10.75',
      bidReasoning: { note: 'Competing offer' },
      bidStatus: 'LOST',
    },
  });
  await prisma.auctionResult.create({
    data: {
      loanApplicationId: application.id,
      winningBidId: firstBid.id,
      finalRate: '10.25',
      selectionReasoning: 'Selected the lowest offered rate.',
    },
  });
}

main()
  .finally(async () => prisma.$disconnect());
