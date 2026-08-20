import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDrainageRisk,
  calculateNetFlow,
  calculateSRI,
  calculateValidatedInflow,
  buildPanProfileTransactions,
  evaluateBorrower,
  evaluateBorrowerWithAudit,
  RULES_VERSION,
  type Transaction,
} from '../src/services/riskEngine.ts';

const transaction = (
  id: string,
  timestamp: string,
  direction: Transaction['direction'],
  grossAmount: number,
  counterpartyEntityHash: string,
  category: string = 'UPI',
): Transaction => ({ id, timestamp, direction, grossAmount, counterpartyEntityHash, category });

const seasonedInflows = (source = 'salary'): Transaction[] => [
  transaction('inflow-1', '2025-01-01T09:00:00Z', 'INFLOW', 100, source, 'SALARY'),
  transaction('inflow-2', '2025-02-01T09:00:00Z', 'INFLOW', 100, source, 'SALARY'),
  transaction('inflow-3', '2025-03-01T09:00:00Z', 'INFLOW', 100, source, 'SALARY'),
];

test('Layer 1 seasons exactly three months and excludes two-month sources', () => {
  const result = calculateValidatedInflow([
    ...seasonedInflows(),
    transaction('short-1', '2025-01-02T09:00:00Z', 'INFLOW', 500, 'short', 'UPI'),
    transaction('short-2', '2025-02-02T09:00:00Z', 'INFLOW', 500, 'short', 'UPI'),
  ]);

  assert.deepEqual(result.seasonedCounterparties, ['salary']);
  assert.equal(result.totalValidatedInflow, 300);
  assert.deepEqual(result.excludedCounterparties, ['short']);
  assert.deepEqual(result.excludedTransactionIds, ['short-1', 'short-2']);
});

test('Layer 2 counts 80 percent, rejects 79 percent, and counts inflows independently', () => {
  const exact = calculateDrainageRisk([
    ...seasonedInflows(),
    transaction('drain-1', '2025-01-01T10:00:00Z', 'OUTFLOW', 80, 'sink'),
    transaction('drain-2', '2025-02-01T10:00:00Z', 'OUTFLOW', 79, 'sink'),
    transaction('drain-3', '2025-03-01T10:00:00Z', 'OUTFLOW', 80, 'sink'),
  ]);

  assert.equal(exact.rapidDrainCount, 2);
  assert.deepEqual(exact.drainedEvents.map((event) => event.inflowTxId), ['inflow-1', 'inflow-3']);
  assert.deepEqual(exact.drainedEvents[0].outflowTxIds, ['drain-1']);
});

test('Layer 3 handles zero income and distinguishes leakage from a surplus', () => {
  const zero = calculateNetFlow([], 0);
  assert.deepEqual(zero, {
    netCashFlow: 0,
    unexplainedOutflowRatio: 0,
    isDeficitWithHighLeakage: false,
    unexplainedOutflowTransactionIds: [],
  });

  const deficit = calculateNetFlow([
    transaction('cash', '2025-01-01T09:00:00Z', 'OUTFLOW', 100, 'cash', 'CASH_WITHDRAWAL'),
    transaction('transfer', '2025-01-01T10:00:00Z', 'OUTFLOW', 50, 'transfer', 'UNCATEGORIZED_TRANSFER'),
  ], 100);
  assert.equal(deficit.isDeficitWithHighLeakage, true);
  assert.equal(deficit.unexplainedOutflowRatio, 1.5);
  assert.deepEqual(deficit.unexplainedOutflowTransactionIds, ['cash', 'transfer']);

  const surplus = calculateNetFlow([
    transaction('cash', '2025-01-01T09:00:00Z', 'OUTFLOW', 20, 'cash', 'CASH_WITHDRAWAL'),
  ], 200);
  assert.equal(surplus.netCashFlow, 180);
  assert.equal(surplus.isDeficitWithHighLeakage, false);
});

test('SRI reasons contain only triggered flags', () => {
  const clean = calculateSRI(
    { totalValidatedInflow: 300, seasonedCounterparties: ['salary'], excludedCounterparties: [], excludedTransactionIds: [] },
    { rapidDrainCount: 0, drainedEvents: [] },
    { netCashFlow: 200, unexplainedOutflowRatio: 0, isDeficitWithHighLeakage: false, unexplainedOutflowTransactionIds: [] },
  );
  assert.deepEqual(clean, { score: 0, action: 'ALLOW_AUCTION', reasons: [] });

  const risky = calculateSRI(
    { totalValidatedInflow: 0, seasonedCounterparties: [], excludedCounterparties: [], excludedTransactionIds: [] },
    { rapidDrainCount: 3, drainedEvents: [] },
    { netCashFlow: -100, unexplainedOutflowRatio: 0.5, isDeficitWithHighLeakage: true, unexplainedOutflowTransactionIds: [] },
  );
  assert.equal(risky.score, 100);
  assert.equal(risky.action, 'BLOCK_AUCTION');
  assert.deepEqual(risky.reasons, [
    'No income source verified for 3+ consecutive months.',
    'Funds swept out within 24 hours of deposit on 3 occasion(s).',
    'Deficit combined with unexplained/uncategorized outflows exceeding 15% of income.',
  ]);
});

test('evaluateBorrower handles realistic clean and defaulter 90-day profiles', () => {
  const good = evaluateBorrower([
    ...seasonedInflows('employer'),
    transaction('bill-1', '2025-01-10T09:00:00Z', 'OUTFLOW', 25, 'biller', 'BILL_PAYMENT'),
    transaction('bill-2', '2025-02-10T09:00:00Z', 'OUTFLOW', 25, 'biller', 'BILL_PAYMENT'),
    transaction('bill-3', '2025-03-10T09:00:00Z', 'OUTFLOW', 25, 'biller', 'BILL_PAYMENT'),
  ]);
  assert.equal(good.action, 'ALLOW_AUCTION');
  assert.ok(good.score <= 35);

  const bad = evaluateBorrower([
    transaction('bad-1', '2025-01-01T09:00:00Z', 'INFLOW', 100, 'source-a', 'UPI'),
    transaction('bad-drain-1', '2025-01-01T10:00:00Z', 'OUTFLOW', 100, 'sink', 'CASH_WITHDRAWAL'),
    transaction('bad-2', '2025-02-01T09:00:00Z', 'INFLOW', 100, 'source-b', 'UPI'),
    transaction('bad-drain-2', '2025-02-01T10:00:00Z', 'OUTFLOW', 100, 'sink', 'CASH_WITHDRAWAL'),
    transaction('bad-3', '2025-03-01T09:00:00Z', 'INFLOW', 100, 'source-c', 'UPI'),
    transaction('bad-drain-3', '2025-03-01T10:00:00Z', 'OUTFLOW', 100, 'sink', 'UNCATEGORIZED_TRANSFER'),
  ]);
  assert.ok(bad.score >= 65);
  assert.equal(bad.action, 'BLOCK_AUCTION');
});

test('the three supported PAN profiles produce distinct underwriting outcomes', () => {
  const disciplined = evaluateBorrower(buildPanProfileTransactions('ABCDE1234A'));
  const chaotic = evaluateBorrower(buildPanProfileTransactions('ABCDE1234B'));
  const defaulter = evaluateBorrower(buildPanProfileTransactions('ABCDE1234C'));

  assert.equal(disciplined.action, 'ALLOW_AUCTION');
  assert.equal(chaotic.action, 'REVIEW');
  assert.equal(defaulter.action, 'BLOCK_AUCTION');
  assert.notEqual(disciplined.score, chaotic.score);
  assert.notEqual(disciplined.score, defaulter.score);
});

test('audit records rapid-drain evidence and preserves the SRI result', () => {
  const transactions = [
    ...seasonedInflows('audited-salary'),
    transaction('audit-drain-1', '2025-01-01T10:00:00Z', 'OUTFLOW', 80, 'sink'),
  ];
  const audit = evaluateBorrowerWithAudit(transactions, 'borrower-123');

  assert.deepEqual(audit.sri, evaluateBorrower(transactions));
  assert.equal(audit.flagDetails[0].flagType, 'RAPID_DRAIN');
  assert.deepEqual(audit.flagDetails[0].supportingTransactionIds, ['inflow-1', 'audit-drain-1']);
  assert.equal(audit.rulesVersion, RULES_VERSION);
});

test('audit leakage evidence contains exactly the unexplained outflows', () => {
  const transactions = [
    ...seasonedInflows('audited-salary'),
    transaction('leak-cash', '2025-03-02T09:00:00Z', 'OUTFLOW', 60, 'cash', 'CASH_WITHDRAWAL'),
    transaction('leak-transfer', '2025-03-03T09:00:00Z', 'OUTFLOW', 60, 'transfer', 'UNCATEGORIZED_TRANSFER'),
    transaction('ordinary-bill', '2025-03-04T09:00:00Z', 'OUTFLOW', 400, 'biller', 'BILL_PAYMENT'),
  ];
  const audit = evaluateBorrowerWithAudit(transactions, 'borrower-456');
  const leakageFlag = audit.flagDetails.find((flag) => flag.flagType === 'DEFICIT_WITH_HIGH_LEAKAGE');

  assert.ok(leakageFlag);
  assert.deepEqual(leakageFlag.supportingTransactionIds, ['leak-cash', 'leak-transfer']);
});

test('empty evaluations produce a valid audit record with no flag details', () => {
  const audit = evaluateBorrowerWithAudit([], 'empty-borrower');

  assert.equal(audit.borrowerId, 'empty-borrower');
  assert.equal(audit.rulesVersion, RULES_VERSION);
  assert.deepEqual(audit.flagDetails, []);
  assert.equal(audit.sri.action, 'REVIEW');
  assert.ok(audit.auditId.length > 0);
  assert.ok(Number.isFinite(Date.parse(audit.evaluatedAt)));
  assert.ok(Number.isFinite(Date.parse(audit.inputWindow.startDate)));
  assert.ok(Number.isFinite(Date.parse(audit.inputWindow.endDate)));
});
