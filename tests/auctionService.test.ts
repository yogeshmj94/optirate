import assert from 'node:assert/strict';
import test from 'node:test';
import { runReverseAuction } from '../src/services/auctionService.ts';

test('high-risk cashflow reaches the auction and receives the high-appetite bank offer', async () => {
  const bids = await runReverseAuction({ fullName: 'High Risk Borrower', requiredAmount: 100000, tenureMonths: 24, creditScore: 560, monthlyIncome: 60000, monthlyExpense: 25000, cashflowRiskScore: 85, cashflowRiskAction: 'BLOCK_AUCTION' });
  assert.equal(bids.find((bid) => bid.lenderId === 'lender_01')?.status, 'Rejected');
  assert.equal(bids.find((bid) => bid.lenderId === 'lender_02')?.status, 'Rejected');
  assert.equal(bids.find((bid) => bid.lenderId === 'lender_03')?.status, 'Approved');
  assert.equal(bids[0].rank, 1);
  assert.equal(bids[0].riskTier, 'HIGH');
});

test('low-risk applicants receive ranked, expiring pre-approved offers', async () => {
  const bids = await runReverseAuction({ fullName: 'Prime Borrower', requiredAmount: 200000, tenureMonths: 36, creditScore: 780, monthlyIncome: 150000, monthlyExpense: 30000, cashflowRiskScore: 10, cashflowRiskAction: 'ALLOW_AUCTION' });
  const approved = bids.filter((bid) => bid.status === 'Approved');
  assert.equal(approved.length, 4);
  assert.deepEqual(approved.map((bid) => bid.rank), [1, 2, 3, 4]);
  assert.ok(approved.every((bid) => bid.offerId && bid.validUntil && bid.calculatedAPR > 0));
});

test('a no-credit-history borrower can qualify through clean cashflow at the high-appetite bank', async () => {
  const bids = await runReverseAuction({ fullName: 'New To Credit', requiredAmount: 75000, tenureMonths: 18, creditScore: 0, monthlyIncome: 85000, monthlyExpense: 60000, cashflowRiskScore: 0, cashflowRiskAction: 'ALLOW_AUCTION' });
  assert.equal(bids.find((bid) => bid.lenderId === 'lender_03')?.status, 'Approved');
  assert.equal(bids.find((bid) => bid.lenderId === 'lender_01')?.status, 'Rejected');
});

test('a high bureau score does not override stressed cashflow lender policies', async () => {
  const bids = await runReverseAuction({ fullName: 'Evergreening Borrower', requiredAmount: 100000, tenureMonths: 24, creditScore: 810, monthlyIncome: 185000, monthlyExpense: 125000, cashflowRiskScore: 45, cashflowRiskAction: 'REVIEW' });
  assert.equal(bids.find((bid) => bid.lenderId === 'lender_01')?.status, 'Approved');
  assert.equal(bids.find((bid) => bid.lenderId === 'lender_02')?.status, 'Rejected');
  assert.equal(bids.find((bid) => bid.lenderId === 'lender_03')?.status, 'Approved');
});

test('progressive banks give disciplined no-history earners reasonably priced offers', async () => {
  const bids = await runReverseAuction({ fullName: 'Gig Worker', requiredAmount: 75000, tenureMonths: 24, creditScore: 0, monthlyIncome: 88500, monthlyExpense: 55833, cashflowRiskScore: 0, cashflowRiskAction: 'ALLOW_AUCTION', borrowerSegment: 'gig_worker_disciplined' });
  const conservative = bids.find((bid) => bid.lenderId === 'lender_01');
  const progressive = bids.filter((bid) => ['lender_02', 'lender_03'].includes(bid.lenderId));
  assert.equal(conservative?.status, 'Rejected');
  assert.ok(progressive.every((bid) => bid.status === 'Approved'));
  assert.ok(progressive.every((bid) => bid.baseInterestRate <= 17));
  assert.ok(progressive.some((bid) => bid.baseInterestRate <= 16.25));
  assert.ok(progressive.every((bid) => (bid.lenderCommissionPercent || 0) > 0));
  assert.ok(progressive.every((bid) => bid.calculatedAPR < 18));
});

test('small-business specialist prices 2 points below the documented 14 percent market floor', async () => {
  const bids = await runReverseAuction({ fullName: 'Small Business Owner', requiredAmount: 100000, tenureMonths: 24, creditScore: 0, monthlyIncome: 161667, monthlyExpense: 100333, cashflowRiskScore: 0, cashflowRiskAction: 'ALLOW_AUCTION', borrowerSegment: 'small_business_disciplined' });
  const udyam = bids.find((bid) => bid.lenderId === 'lender_06');
  assert.equal(udyam?.status, 'Approved');
  assert.equal(udyam?.baseInterestRate, 12);
  assert.equal(udyam?.marketBenchmarkRate, 14);
  assert.equal(udyam?.marketDiscountPercent, 2);
  assert.equal(udyam?.lenderCommissionPercent, 1.5);
});

test('banks can extend tenure independently to bring projected DTI within policy', async () => {
  const bids = await runReverseAuction({ fullName: 'Tenure Adjustment', requiredAmount: 500000, tenureMonths: 12, creditScore: 700, monthlyIncome: 100000, monthlyExpense: 60000, fixedMonthlyObligations: 40000, cashflowRiskScore: 0, cashflowRiskAction: 'ALLOW_AUCTION', borrowerSegment: 'standard_average' });
  const nova = bids.find((bid) => bid.lenderId === 'lender_02');
  assert.equal(nova?.status, 'Approved');
  assert.ok((nova?.offeredTenureMonths || 0) > 12);
  assert.ok((nova?.projectedDtiPercent || 100) <= (nova?.maxDtiPercent || 0));
  assert.match(nova?.decisionReason || '', /tenure extended/);
});
