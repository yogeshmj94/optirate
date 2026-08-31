export interface Transaction {
  id: string;
  timestamp: string;
  direction: 'INFLOW' | 'OUTFLOW';
  grossAmount: number;
  counterpartyEntityHash: string;
  category:
    | 'SALARY'
    | 'UPI'
    | 'CASH_WITHDRAWAL'
    | 'UNCATEGORIZED_TRANSFER'
    | 'BILL_PAYMENT'
    | 'EMI'
    | string;
}

export type CashflowTransaction = Transaction;

export interface ValidatedInflowResult {
  totalValidatedInflow: number;
  seasonedCounterparties: string[];
  excludedCounterparties: string[];
  excludedTransactionIds: string[];
}

export interface DrainageRiskResult {
  rapidDrainCount: number;
  drainedEvents: Array<{ inflowTxId: string; outflowTxIds: string[]; drainedRatio: number }>;
}

export interface NetFlowResult {
  netCashFlow: number;
  unexplainedOutflowRatio: number;
  isDeficitWithHighLeakage: boolean;
  unexplainedOutflowTransactionIds: string[];
}

export interface SRIResult {
  score: number;
  action: 'ALLOW_AUCTION' | 'REVIEW' | 'BLOCK_AUCTION';
  reasons: string[];
}

export type FlagType =
  | 'NO_SEASONED_INCOME'
  | 'RAPID_DRAIN'
  | 'NET_DEFICIT'
  | 'DEFICIT_WITH_HIGH_LEAKAGE';

export interface FlagDetail {
  flagType: FlagType;
  reason: string;
  scoreContribution: number;
  supportingTransactionIds: string[];
}

export interface RiskDecisionAuditRecord {
  auditId: string;
  borrowerId: string;
  evaluatedAt: string;
  rulesVersion: string;
  inputWindow: {
    startDate: string;
    endDate: string;
  };
  sri: SRIResult;
  flagDetails: FlagDetail[];
}

// Bump this manually whenever a scoring threshold or point value changes so historical decisions remain attributable.
export const RULES_VERSION = '2026.08.1';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const timestampValue = (timestamp: string): number | null => {
  const value = new Date(timestamp).getTime();
  return Number.isFinite(value) ? value : null;
};

const validAmount = (amount: number): number => (Number.isFinite(amount) && amount > 0 ? amount : 0);

export function calculateValidatedInflow(transactions: Transaction[]): ValidatedInflowResult {
  const sourceMonths = transactions
    .filter((transaction) => transaction.direction === 'INFLOW' && timestampValue(transaction.timestamp) !== null)
    .reduce((monthsBySource, transaction) => {
      const month = new Date(transaction.timestamp).toISOString().slice(0, 7);
      const currentMonths = monthsBySource.get(transaction.counterpartyEntityHash) ?? new Set<string>();
      return new Map(monthsBySource).set(transaction.counterpartyEntityHash, new Set(currentMonths).add(month));
    }, new Map<string, Set<string>>());

  const seasonedCounterparties = Array.from(sourceMonths.entries())
    .filter(([, months]) => months.size >= 3)
    .map(([counterpartyEntityHash]) => counterpartyEntityHash);
  const excludedCounterparties = Array.from(sourceMonths.keys())
    .filter((counterpartyEntityHash) => !seasonedCounterparties.includes(counterpartyEntityHash));
  const seasonedSet = new Set(seasonedCounterparties);
  const excludedTransactionIds = transactions
    .filter(
      (transaction) =>
        transaction.direction === 'INFLOW' &&
        !seasonedSet.has(transaction.counterpartyEntityHash),
    )
    .map((transaction) => transaction.id);

  const totalValidatedInflow = transactions
    .filter(
      (transaction) =>
        transaction.direction === 'INFLOW' &&
        seasonedCounterparties.includes(transaction.counterpartyEntityHash),
    )
    .reduce((total, transaction) => total + validAmount(transaction.grossAmount), 0);

  return {
    totalValidatedInflow,
    seasonedCounterparties,
    excludedCounterparties,
    excludedTransactionIds,
  };
}

export function calculateDrainageRisk(transactions: Transaction[]): DrainageRiskResult {
  const inflows = transactions
    .filter(
      (transaction) =>
        transaction.direction === 'INFLOW' &&
        validAmount(transaction.grossAmount) > 0 &&
        timestampValue(transaction.timestamp) !== null,
    )
    .sort((left, right) => (timestampValue(left.timestamp) ?? 0) - (timestampValue(right.timestamp) ?? 0));
  const outflows = transactions
    .filter((transaction) => transaction.direction === 'OUTFLOW' && timestampValue(transaction.timestamp) !== null)
    .sort((left, right) => (timestampValue(left.timestamp) ?? 0) - (timestampValue(right.timestamp) ?? 0));

  const drainedEvents = inflows.reduce<{
    left: number;
    right: number;
    amount: number;
    events: DrainageRiskResult['drainedEvents'];
  }>((window, inflow) => {
    const inflowTime = timestampValue(inflow.timestamp) ?? 0;
    let left = window.left;
    let right = window.right;
    let amount = window.amount;

    while (left < right && (timestampValue(outflows[left].timestamp) ?? 0) < inflowTime) {
      amount -= validAmount(outflows[left].grossAmount);
      left += 1;
    }
    while (right < outflows.length && (timestampValue(outflows[right].timestamp) ?? 0) <= inflowTime + DAY_IN_MILLISECONDS) {
      amount += validAmount(outflows[right].grossAmount);
      right += 1;
    }

    const drainedRatio = amount / validAmount(inflow.grossAmount);
    const outflowTxIds = outflows.slice(left, right).map((outflow) => outflow.id);
    return {
      left,
      right,
      amount,
      events: drainedRatio >= 0.8
        ? [...window.events, { inflowTxId: inflow.id, outflowTxIds, drainedRatio }]
        : window.events,
    };
  }, { left: 0, right: 0, amount: 0, events: [] }).events;

  return { rapidDrainCount: drainedEvents.length, drainedEvents };
}

export function calculateNetFlow(transactions: Transaction[], totalValidatedInflow: number): NetFlowResult {
  const totalOutflow = transactions
    .filter((transaction) => transaction.direction === 'OUTFLOW')
    .reduce((total, transaction) => total + validAmount(transaction.grossAmount), 0);
  const unexplainedOutflow = transactions
    .filter(
      (transaction) =>
        transaction.direction === 'OUTFLOW' &&
        (transaction.category === 'UNCATEGORIZED_TRANSFER' || transaction.category === 'CASH_WITHDRAWAL'),
    )
    .reduce((total, transaction) => total + validAmount(transaction.grossAmount), 0);
  const unexplainedOutflowTransactionIds = transactions
    .filter(
      (transaction) =>
        transaction.direction === 'OUTFLOW' &&
        (transaction.category === 'UNCATEGORIZED_TRANSFER' || transaction.category === 'CASH_WITHDRAWAL'),
    )
    .map((transaction) => transaction.id);
  // No validated income means there is no income base from which to measure leakage.
  const unexplainedOutflowRatio = totalValidatedInflow > 0 ? unexplainedOutflow / totalValidatedInflow : 0;
  const netCashFlow = totalValidatedInflow - totalOutflow;

  return {
    netCashFlow,
    unexplainedOutflowRatio,
    isDeficitWithHighLeakage: netCashFlow < 0 && unexplainedOutflowRatio > 0.15,
    unexplainedOutflowTransactionIds,
  };
}

export function calculateSRI(
  seasoning: ValidatedInflowResult,
  drainage: DrainageRiskResult,
  netFlow: NetFlowResult,
): SRIResult {
  const reasons: string[] = [];
  const seasoningPenalty = seasoning.seasonedCounterparties.length === 0 ? 40 : 0;
  if (seasoningPenalty > 0) reasons.push('No income source verified for 3+ consecutive months.');

  const drainagePenalty = Math.min(drainage.rapidDrainCount * 10, 30);
  if (drainage.rapidDrainCount > 0) {
    reasons.push(`Funds swept out within 24 hours of deposit on ${drainage.rapidDrainCount} occasion(s).`);
  }

  const deficitPenalty = netFlow.isDeficitWithHighLeakage ? 30 : netFlow.netCashFlow < 0 ? 15 : 0;
  if (netFlow.isDeficitWithHighLeakage) {
    reasons.push('Deficit combined with unexplained/uncategorized outflows exceeding 15% of income.');
  } else if (netFlow.netCashFlow < 0) {
    reasons.push('Spending exceeds validated income.');
  }

  const score = Math.max(0, Math.min(100, seasoningPenalty + drainagePenalty + deficitPenalty));
  const action = score <= 35 ? 'ALLOW_AUCTION' : score >= 65 ? 'BLOCK_AUCTION' : 'REVIEW';
  return { score, action, reasons };
}

export function evaluateBorrower(transactions: Transaction[]): SRIResult {
  const seasoning = calculateValidatedInflow(transactions);
  const drainage = calculateDrainageRisk(transactions);
  const netFlow = calculateNetFlow(transactions, seasoning.totalValidatedInflow);
  return calculateSRI(seasoning, drainage, netFlow);
}

const uniqueIds = (ids: string[]): string[] => Array.from(new Set(ids));

export function evaluateBorrowerWithAudit(
  transactions: Transaction[],
  borrowerId: string,
): RiskDecisionAuditRecord {
  const evaluatedAt = new Date().toISOString();
  const seasoning = calculateValidatedInflow(transactions);
  const drainage = calculateDrainageRisk(transactions);
  const netFlow = calculateNetFlow(transactions, seasoning.totalValidatedInflow);
  const sri = calculateSRI(seasoning, drainage, netFlow);
  const validTimes = transactions
    .map((transaction) => timestampValue(transaction.timestamp))
    .filter((value): value is number => value !== null);
  const endTime = validTimes.length > 0 ? Math.max(...validTimes) : new Date(evaluatedAt).getTime();
  const startDate = new Date(endTime - (90 * DAY_IN_MILLISECONDS)).toISOString();
  const endDate = new Date(endTime).toISOString();
  const flagDetails: FlagDetail[] = [];

  if (transactions.length > 0 && seasoning.seasonedCounterparties.length === 0) {
    flagDetails.push({
      flagType: 'NO_SEASONED_INCOME',
      reason: 'No income source verified for 3+ consecutive months.',
      scoreContribution: 40,
      supportingTransactionIds: seasoning.excludedTransactionIds,
    });
  }

  if (drainage.rapidDrainCount > 0) {
    flagDetails.push({
      flagType: 'RAPID_DRAIN',
      reason: `Funds swept out within 24 hours of deposit on ${drainage.rapidDrainCount} occasion(s).`,
      scoreContribution: Math.min(drainage.rapidDrainCount * 10, 30),
      supportingTransactionIds: uniqueIds(
        drainage.drainedEvents.flatMap((event) => [event.inflowTxId, ...event.outflowTxIds]),
      ),
    });
  }

  if (netFlow.isDeficitWithHighLeakage) {
    flagDetails.push({
      flagType: 'DEFICIT_WITH_HIGH_LEAKAGE',
      reason: 'Deficit combined with unexplained/uncategorized outflows exceeding 15% of income.',
      scoreContribution: 30,
      supportingTransactionIds: netFlow.unexplainedOutflowTransactionIds,
    });
  } else if (netFlow.netCashFlow < 0) {
    flagDetails.push({
      flagType: 'NET_DEFICIT',
      reason: 'Spending exceeds validated income.',
      scoreContribution: 15,
      supportingTransactionIds: transactions
        .filter((transaction) => transaction.direction === 'OUTFLOW')
        .map((transaction) => transaction.id),
    });
  }

  return {
    auditId: globalThis.crypto.randomUUID(),
    borrowerId,
    evaluatedAt,
    rulesVersion: RULES_VERSION,
    inputWindow: { startDate, endDate },
    sri,
    flagDetails,
  };
}
