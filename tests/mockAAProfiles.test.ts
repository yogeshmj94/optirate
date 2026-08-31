import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSixMonthStatement, MOCK_AA_PROFILES } from '../src/services/mockAAProfiles.ts';
import { evaluateBorrower } from '../src/services/riskEngine.ts';

test('each AA persona contains six complete statement months and canonical transaction fields', () => {
  for (const profile of MOCK_AA_PROFILES) {
    const statement = buildSixMonthStatement(profile.id);
    const months = new Set(statement.map((transaction) => transaction.timestamp.slice(0, 7)));
    assert.equal(months.size, 6, `${profile.id} should cover six months`);
    assert.ok(statement.length >= 30, `${profile.id} should contain realistic monthly activity`);
    assert.ok(statement.every((transaction) => transaction.amount === transaction.grossAmount));
    assert.ok(statement.every((transaction) => transaction.type === (transaction.direction === 'INFLOW' ? 'CREDIT' : 'DEBIT')));
    assert.ok(statement.every((transaction) => Number.isFinite(transaction.balance)));
  }
});

test('persona bureau metadata covers prime, disguised stress, medium, defaulter, and no-history workers', () => {
  assert.deepEqual(MOCK_AA_PROFILES.map((profile) => profile.bureauStatus), ['HIGH', 'HIGH_STRESSED', 'MEDIUM', 'LOW_DEFAULTER', 'NO_HISTORY', 'NO_HISTORY_GIG', 'NO_HISTORY_BUSINESS']);
  assert.equal(MOCK_AA_PROFILES.find((profile) => profile.bureauStatus === 'NO_HISTORY')?.creditScore, 0);
  assert.ok(MOCK_AA_PROFILES.every((profile) => profile.recommendedPan === 'ABCDE1234A'));
});

test('six-month cashflows produce clean, review, and chaotic underwriting outcomes', () => {
  const prime = evaluateBorrower(buildSixMonthStatement('prime_clean'));
  const average = evaluateBorrower(buildSixMonthStatement('standard_average'));
  const highScoreStressed = evaluateBorrower(buildSixMonthStatement('high_score_stressed'));
  const chaotic = evaluateBorrower(buildSixMonthStatement('defaulter_chaotic'));
  const thinFile = evaluateBorrower(buildSixMonthStatement('thin_file_clean'));
  const gigWorker = evaluateBorrower(buildSixMonthStatement('gig_worker_disciplined'));
  const smallBusiness = evaluateBorrower(buildSixMonthStatement('small_business_disciplined'));
  assert.equal(prime.action, 'ALLOW_AUCTION');
  assert.equal(average.action, 'REVIEW');
  assert.equal(highScoreStressed.action, 'REVIEW');
  assert.ok(highScoreStressed.reasons.some((reason) => reason.includes('Funds swept out')));
  assert.equal(chaotic.action, 'BLOCK_AUCTION');
  assert.equal(thinFile.action, 'ALLOW_AUCTION');
  assert.equal(gigWorker.action, 'ALLOW_AUCTION');
  assert.equal(smallBusiness.action, 'ALLOW_AUCTION');
  assert.ok(prime.score < average.score && average.score < chaotic.score);
});

test('gig and small-business personas have inconsistent income but positive savings every month', () => {
  for (const profileId of ['gig_worker_disciplined', 'small_business_disciplined'] as const) {
    const statement = buildSixMonthStatement(profileId);
    const monthly = new Map<string, { inflow: number; outflow: number }>();
    for (const transaction of statement) {
      const month = transaction.timestamp.slice(0, 7);
      const totals = monthly.get(month) || { inflow: 0, outflow: 0 };
      if (transaction.direction === 'INFLOW') totals.inflow += transaction.grossAmount;
      else totals.outflow += transaction.grossAmount;
      monthly.set(month, totals);
    }
    assert.equal(monthly.size, 6);
    assert.ok(new Set([...monthly.values()].map((totals) => totals.inflow)).size >= 5);
    assert.ok([...monthly.values()].every((totals) => totals.inflow > totals.outflow));
  }
});

test('high-score stressed statement contains recurring evergreening and friends/family funding evidence', () => {
  const statement = buildSixMonthStatement('high_score_stressed');
  assert.equal(statement.filter((transaction) => transaction.category === 'CREDIT_CARD_CASH_LIKE').length, 6);
  assert.equal(statement.filter((transaction) => transaction.category === 'CREDIT_CARD_PAYMENT').length, 6);
  assert.equal(statement.filter((transaction) => transaction.category === 'FRIENDS_FAMILY_TRANSFER').length, 6);
  assert.equal(statement.filter((transaction) => transaction.category === 'EMI').length, 6);
});
