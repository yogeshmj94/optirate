export type LedgerDirection = 'INFLOW' | 'OUTFLOW';
export type TransactionCategory =
  | 'SALARY'
  | 'RENT'
  | 'UTILITY'
  | 'CREDIT_CARD'
  | 'CASH_WITHDRAWAL'
  | 'UNCATEGORIZED_TRANSFER'
  | 'FIXED_DEPOSIT'
  | 'UPI'
  | 'EMI'
  | 'OTHER';

export interface CashflowTransaction {
  date: string;
  amount: number;
  direction: LedgerDirection;
  narration: string;
  category?: TransactionCategory;
  counterpartyEntityHash?: string;
}

export interface RiskInput {
  creditScore: number;
  monthlyIncome: number;
  monthlyExpense: number;
  isFirstTimeBorrower?: boolean;
  transactions?: CashflowTransaction[];
}

export interface RiskEngineResult {
  riskScore: number;
  sri: number;
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
  effectiveCreditScore: number;
  disciplineScore: number;
  stableInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  drainageRiskScore: number;
  rapidDrainFlags: number;
  validatedSources: string[];
  ignoredDeposits: number;
  eligibility: 'ALLOW_AUCTION' | 'REVIEW' | 'BLOCK_AUCTION';
  reasons: string[];
}

export interface ThermodynamicRiskMetrics {
  inflowEntropy: number;
  outflowEntropy: number;
  wasteHeatRatio: number;
  entropyDelta: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const normalizeNarration = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const safeLog2 = (value: number): number => (value > 0 ? Math.log2(value) : 0);

const addUniqueMonth = (sourceMonths: Map<string, Set<string>>, hash: string, monthKey: string) => {
  if (!sourceMonths.has(hash)) sourceMonths.set(hash, new Set<string>());
  sourceMonths.get(hash)!.add(monthKey);
};

const bucketLabels = ['micro', 'small', 'medium', 'large', 'extreme'] as const;

type BucketName = typeof bucketLabels[number];

type BucketDistribution = Record<BucketName, number>;

const bucketForAmount = (amount: number): BucketName => {
  if (amount <= 5000) return 'micro';
  if (amount <= 25000) return 'small';
  if (amount <= 75000) return 'medium';
  if (amount <= 150000) return 'large';
  return 'extreme';
};

function getBucketDistribution(transactions: CashflowTransaction[], direction: LedgerDirection): BucketDistribution {
  const initial: BucketDistribution = { micro: 0, small: 0, medium: 0, large: 0, extreme: 0 };
  const filtered = transactions.filter((tx) => tx.direction === direction);

  return filtered.reduce((distribution, tx) => {
    const bucket = bucketForAmount(Math.abs(tx.amount));
    distribution[bucket] += 1;
    return distribution;
  }, initial);
}

function calculateBucketEntropy(transactions: CashflowTransaction[], direction: LedgerDirection): number {
  const distribution = getBucketDistribution(transactions, direction);
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);

  if (total === 0) return 0;

  const entropy = (Object.values(distribution) as number[])
    .map((count) => {
      const probability = count / total;
      return probability > 0 ? -probability * safeLog2(probability) : 0;
    })
    .reduce((sum, value) => sum + value, 0);

  return Number(entropy.toFixed(6));
}

function evaluateSeasonedInflow(transactions: CashflowTransaction[]) {
  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const sourceMonths = new Map<string, Set<string>>();
  const sourceAmount = new Map<string, number>();

  for (const tx of sorted) {
    if (tx.direction !== 'INFLOW') continue;
    const hash = tx.counterpartyEntityHash || normalizeNarration(tx.narration) || 'UNKNOWN_SOURCE';
    const monthKey = new Date(tx.date).toISOString().slice(0, 7);
    addUniqueMonth(sourceMonths, hash, monthKey);
    sourceAmount.set(hash, (sourceAmount.get(hash) || 0) + tx.amount);
  }

  const seasonedSources = [...sourceMonths.entries()]
    .filter(([, months]) => months.size >= 3)
    .map(([hash, months]) => ({ hash, months: months.size, amount: sourceAmount.get(hash) || 0 }));

  const validatedSource = seasonedSources.sort((a, b) => b.amount - a.amount)[0];
  const validatedInflow = validatedSource ? sourceAmount.get(validatedSource.hash) || 0 : 0;
  const oneTimeDepositAmount = sorted
    .filter((tx) => tx.direction === 'INFLOW' && (!tx.counterpartyEntityHash || (sourceMonths.get(tx.counterpartyEntityHash)?.size || 0) < 3))
    .reduce((sum, tx) => sum + tx.amount, 0);

  return {
    validatedInflow,
    seasonedSources,
    source: validatedSource?.hash || 'UNKNOWN_SOURCE',
    sourceMonthsCount: validatedSource?.months || 0,
    oneTimeDepositAmount,
  };
}

function evaluateDrainage(transactions: CashflowTransaction[], validatedInflow: number) {
  const inflows = transactions.filter((tx) => tx.direction === 'INFLOW');
  const outflows = transactions.filter((tx) => tx.direction === 'OUTFLOW');
  let rapidDrainFlags = 0;
  let drainedAmount = 0;

  for (const inflow of inflows) {
    const inflowDate = new Date(inflow.date).getTime();
    const next24Hours = outflows.filter((outflow) => {
      const outflowDate = new Date(outflow.date).getTime();
      return outflowDate >= inflowDate && outflowDate <= inflowDate + 24 * 60 * 60 * 1000;
    });
    const swept = next24Hours.reduce((sum, tx) => sum + tx.amount, 0);

    if (inflow.amount > 0 && swept >= inflow.amount * 0.8) {
      rapidDrainFlags += 1;
      drainedAmount += swept;
    }
  }

  const drainageRiskScore = rapidDrainFlags > 0 ? Math.min(40, rapidDrainFlags * 15 + Math.round((drainedAmount / Math.max(validatedInflow, 1)) * 10)) : 0;

  return {
    rapidDrainFlags,
    drainageRiskScore,
  };
}

export function calculateThermodynamicRiskMetrics(transactions: CashflowTransaction[]): ThermodynamicRiskMetrics {
  const ninetyDayWindow = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    const now = new Date();
    const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    return txDate >= start && txDate <= now;
  });

  const firstWindow = ninetyDayWindow.filter((tx) => {
    const txDate = new Date(tx.date);
    const now = new Date();
    const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const dayDiff = Math.floor((now.getTime() - txDate.getTime()) / (24 * 60 * 60 * 1000));
    return txDate >= start && dayDiff <= 45;
  });

  const secondWindow = ninetyDayWindow.filter((tx) => {
    const txDate = new Date(tx.date);
    const now = new Date();
    const dayDiff = Math.floor((now.getTime() - txDate.getTime()) / (24 * 60 * 60 * 1000));
    return dayDiff > 45 && dayDiff <= 90;
  });

  const inflowEntropy = calculateBucketEntropy(ninetyDayWindow, 'INFLOW');
  const outflowEntropy = calculateBucketEntropy(ninetyDayWindow, 'OUTFLOW');

  const totalValidatedInflows = ninetyDayWindow
    .filter((tx) => tx.direction === 'INFLOW')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const uncategorizedLeakage = ninetyDayWindow
    .filter((tx) => tx.direction === 'OUTFLOW' && (tx.category === 'UNCATEGORIZED_TRANSFER' || tx.category === 'CASH_WITHDRAWAL'))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const wasteHeatRatio = totalValidatedInflows > 0 ? uncategorizedLeakage / totalValidatedInflows : 0;
  const entropyDelta = calculateBucketEntropy(secondWindow, 'INFLOW') - calculateBucketEntropy(firstWindow, 'INFLOW');

  return {
    inflowEntropy,
    outflowEntropy,
    wasteHeatRatio: Number(wasteHeatRatio.toFixed(6)),
    entropyDelta: Number(entropyDelta.toFixed(6)),
  };
}

export function calculateAdjustedSRI(baseSRI: number, thermoMetrics: ThermodynamicRiskMetrics): number {
  const { entropyDelta, wasteHeatRatio } = thermoMetrics;

  if (entropyDelta <= 0 || wasteHeatRatio <= 0.15) {
    return baseSRI;
  }

  const penalty = Math.log1p((entropyDelta * 10) + (wasteHeatRatio * 5)) * 8;
  return clamp(Number((baseSRI + penalty).toFixed(2)), 0, 100);
}

export function evaluateBorrowerRisk(input: RiskInput): RiskEngineResult {
  const transactions = input.transactions || [];
  const recentTransactions = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    return txDate >= cutoff;
  });

  const { validatedInflow, seasonedSources, source, sourceMonthsCount, oneTimeDepositAmount } = evaluateSeasonedInflow(recentTransactions);
  const totalOutflow = recentTransactions
    .filter((tx) => tx.direction === 'OUTFLOW')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const netCashFlow = validatedInflow - totalOutflow;
  const disciplineScore = clamp(Math.round((netCashFlow / Math.max(validatedInflow, 1)) * 100), -100, 100);
  const { rapidDrainFlags, drainageRiskScore } = evaluateDrainage(recentTransactions, validatedInflow);

  const firstTimeBorrowerBoost = input.isFirstTimeBorrower && sourceMonthsCount >= 3 ? 8 : 0;
  const seasonalScore = sourceMonthsCount >= 3 ? 0 : 22;
  const deficitScore = netCashFlow < 0 ? 25 : 0;
  const netSurplusBonus = netCashFlow > 0 ? Math.min(12, Math.round((netCashFlow / Math.max(validatedInflow, 1)) * 100)) : 0;
  const bureauAdjustment = clamp(Math.round((input.creditScore - 300) / 10), 0, 60);
  const effectiveCreditScore = clamp(
    Math.round(input.creditScore + Math.max(0, disciplineScore) * 0.25 + firstTimeBorrowerBoost + bureauAdjustment),
    300,
    900
  );

  const sri = clamp(
    20 +
      seasonalScore +
      deficitScore +
      drainageRiskScore +
      (rapidDrainFlags > 0 ? 15 : 0) -
      netSurplusBonus -
      firstTimeBorrowerBoost,
    0,
    100
  );

  const reasons: string[] = [];
  if (sourceMonthsCount >= 3) {
    reasons.push(`Layer 1 passed: ${source} is seasoned across ${sourceMonthsCount} consecutive months and validated as eligible inflow.`);
  } else {
    reasons.push('Layer 1 failed: inflow has fewer than 3 months of source seasoning, so one-time deposits are excluded from income capacity.');
  }

  if (rapidDrainFlags > 0) {
    reasons.push(`Layer 2 flagged ${rapidDrainFlags} rapid drainage sweep event(s) within 24 hours of incoming funds.`);
  } else {
    reasons.push('Layer 2 cleared: bank account did not show a 24-hour cash sweep pattern.');
  }

  if (netCashFlow >= 0) {
    reasons.push(`Layer 3 passed: net operational surplus is ₹${Math.round(netCashFlow).toLocaleString()} after subtracting outflows.`);
  } else {
    reasons.push(`Layer 3 failed: net operational deficit is ₹${Math.abs(Math.round(netCashFlow)).toLocaleString()}, indicating burn pressure.`);
  }

  const eligibility: RiskEngineResult['eligibility'] = sri <= 35 ? 'ALLOW_AUCTION' : sri >= 65 ? 'BLOCK_AUCTION' : 'REVIEW';
  const riskBand: RiskEngineResult['riskBand'] = sri <= 35 ? 'LOW' : sri >= 65 ? 'HIGH' : 'MEDIUM';

  return {
    riskScore: clamp(Math.round(effectiveCreditScore - sri * 0.9), 300, 900),
    sri,
    riskBand,
    effectiveCreditScore,
    disciplineScore,
    stableInflow: validatedInflow,
    totalOutflow,
    netCashFlow,
    drainageRiskScore,
    rapidDrainFlags,
    validatedSources: seasonedSources.map((item) => item.hash),
    ignoredDeposits: Math.round(oneTimeDepositAmount),
    eligibility,
    reasons,
  };
}

export function buildMockCashflowHistory(sourceName = 'TATA_EMPLOYER_CORP_HASH'): CashflowTransaction[] {
  const now = new Date();
  const history: CashflowTransaction[] = [];
  const recurringSalary = 120000;
  const recurringOutflow = 42000;
  const oneTimeDeposit = 250000;

  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const salaryHash = sourceName;
    const depositHash = 'FIXED_DEPOSIT_MATURITY_HASH';

    history.push({
      date: date.toISOString(),
      amount: recurringSalary,
      direction: 'INFLOW',
      narration: 'salary credit',
      category: 'SALARY',
      counterpartyEntityHash: salaryHash,
    });

    history.push({
      date: date.toISOString(),
      amount: recurringOutflow,
      direction: 'OUTFLOW',
      narration: 'rent utility emi',
      category: 'RENT',
      counterpartyEntityHash: 'UTILITY_BILLER_HASH',
    });

    if (i === 0) {
      history.push({
        date: new Date(now.getFullYear(), now.getMonth(), 2).toISOString(),
        amount: oneTimeDeposit,
        direction: 'INFLOW',
        narration: 'fixed deposit maturity',
        category: 'FIXED_DEPOSIT',
        counterpartyEntityHash: depositHash,
      });
      history.push({
        date: new Date(now.getFullYear(), now.getMonth(), 4).toISOString(),
        amount: oneTimeDeposit * 0.9,
        direction: 'OUTFLOW',
        narration: 'cash sweep to atm',
        category: 'CASH_WITHDRAWAL',
        counterpartyEntityHash: 'UPI_SINK_HASH',
      });
    }
  }

  return history;
}

export function buildPanProfileTransactions(pan: string): CashflowTransaction[] {
  const now = new Date();
  const history: CashflowTransaction[] = [];
  const months = 6;
  const perMonth = 10;

  const profileConfigs: Record<string, { creditScore: number; firstTimeBorrower: boolean; inflow: number; outflow: number; sourceHash: string; chaotic: boolean }> = {
    ABCDE1234A: {
      creditScore: 660,
      firstTimeBorrower: true,
      inflow: 120000,
      outflow: 42000,
      sourceHash: 'TATA_EMPLOYER_CORP_HASH',
      chaotic: false,
    },
    ABCDE1234B: {
      creditScore: 850,
      firstTimeBorrower: false,
      inflow: 160000,
      outflow: 60000,
      sourceHash: 'RANDOM_FI_SOURCE_HASH',
      chaotic: true,
    },
    ABCDE1234C: {
      creditScore: 420,
      firstTimeBorrower: false,
      inflow: 90000,
      outflow: 120000,
      sourceHash: 'UNSEASONED_SOURCE_HASH',
      chaotic: true,
    },
  };

  const profile = profileConfigs[pan];
  if (!profile) {
    return [];
  }

  for (let monthIndex = 0; monthIndex < months; monthIndex += 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (months - 1 - monthIndex), 1);

    for (let txIndex = 0; txIndex < perMonth; txIndex += 1) {
      const txDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), txIndex + 1);
      const salaryAmount = profile.inflow;
      const outflowAmount = profile.outflow;

      if (txIndex === 0) {
        history.push({
          date: txDate.toISOString(),
          amount: salaryAmount,
          direction: 'INFLOW',
          narration: 'salary credit',
          category: 'SALARY',
          counterpartyEntityHash: profile.sourceHash,
        });
      } else if (txIndex === 1) {
        history.push({
          date: txDate.toISOString(),
          amount: outflowAmount,
          direction: 'OUTFLOW',
          narration: 'rent utility emi',
          category: 'RENT',
          counterpartyEntityHash: 'UTILITY_BILLER_HASH',
        });
      } else if (txIndex === 2) {
        history.push({
          date: txDate.toISOString(),
          amount: Math.round(outflowAmount * 0.3),
          direction: 'OUTFLOW',
          narration: 'utility bill',
          category: 'UTILITY',
          counterpartyEntityHash: 'UTILITY_BILLER_HASH',
        });
      } else if (txIndex === 3 && profile.chaotic) {
        history.push({
          date: txDate.toISOString(),
          amount: Math.round(salaryAmount * 0.75),
          direction: 'OUTFLOW',
          narration: 'cash withdrawal',
          category: 'CASH_WITHDRAWAL',
          counterpartyEntityHash: 'CASH_SINK_HASH',
        });
      } else if (txIndex === 4 && profile.chaotic) {
        history.push({
          date: txDate.toISOString(),
          amount: Math.round(salaryAmount * 0.2),
          direction: 'OUTFLOW',
          narration: 'uncategorized transfer',
          category: 'UNCATEGORIZED_TRANSFER',
          counterpartyEntityHash: 'UNKNOWN_HASH',
        });
      } else if (txIndex === 5 && profile.chaotic) {
        history.push({
          date: txDate.toISOString(),
          amount: Math.round(outflowAmount * 0.5),
          direction: 'OUTFLOW',
          narration: 'credit card bill',
          category: 'CREDIT_CARD',
          counterpartyEntityHash: 'CARD_HASH',
        });
      } else {
        history.push({
          date: txDate.toISOString(),
          amount: Math.round(outflowAmount * 0.15),
          direction: 'OUTFLOW',
          narration: 'upi txn',
          category: 'UPI',
          counterpartyEntityHash: 'UPI_HASH',
        });
      }
    }
  }

  return history;
}
