import { calculateTrueAPR } from '../lib/aprCalculator';
import { BankSchemaAdapter, type StandardBorrowerProfile } from './bankAdapterService';
import type { LoanBid } from '../types/lending';

type BankPolicy = { id: string; name: string; path: string; baseRate: number; feePercent: number; commissionPercent: number; maxDti: number | null; maxTenure: number; riskAppetite: 'CONSERVATIVE' | 'BALANCED' | 'HIGH'; segment?: 'GIG' | 'BUSINESS' | 'GENERAL' };

const BANKS: BankPolicy[] = [
  { id: 'lender_01', name: 'Aster National Bank', path: '/banks/aster/preapproved-offers', baseRate: 10.25, feePercent: 0.5, commissionPercent: 1, maxDti: null, maxTenure: 60, riskAppetite: 'CONSERVATIVE' },
  { id: 'lender_02', name: 'Nova Digital Bank', path: '/banks/nova/preapproved-offers', baseRate: 16.25, feePercent: 0.25, commissionPercent: 1.25, maxDti: 0.55, maxTenure: 60, riskAppetite: 'BALANCED', segment: 'GENERAL' },
  { id: 'lender_03', name: 'Summit Opportunity Bank', path: '/banks/summit/preapproved-offers', baseRate: 16.75, feePercent: 0.5, commissionPercent: 1.5, maxDti: 0.65, maxTenure: 72, riskAppetite: 'HIGH', segment: 'GENERAL' },
  { id: 'lender_04', name: 'FlowTrust Cashflow Bank', path: '/banks/flowtrust/preapproved-offers', baseRate: 16.0, feePercent: 0.25, commissionPercent: 1.25, maxDti: 0.5, maxTenure: 60, riskAppetite: 'BALANCED', segment: 'GENERAL' },
  { id: 'lender_05', name: 'FlexWork Bank', path: '/banks/flexwork/preapproved-offers', baseRate: 16.0, feePercent: 0.25, commissionPercent: 1.5, maxDti: 0.6, maxTenure: 60, riskAppetite: 'BALANCED', segment: 'GIG' },
  { id: 'lender_06', name: 'Udyam Growth Bank', path: '/banks/udyam/preapproved-offers', baseRate: 12.0, feePercent: 0.5, commissionPercent: 1.5, maxDti: 0.55, maxTenure: 72, riskAppetite: 'BALANCED', segment: 'BUSINESS' },
];

const emi = (principal: number, annualRate: number, months: number): number => {
  const monthlyRate = annualRate / 1200;
  if (monthlyRate === 0) return principal / months;
  return principal * monthlyRate * ((1 + monthlyRate) ** months) / (((1 + monthlyRate) ** months) - 1);
};

const localDecision = (bank: BankPolicy, profile: StandardBorrowerProfile) => {
  const highAppetite = bank.riskAppetite === 'HIGH';
  const isGig = profile.borrowerSegment === 'gig_worker_disciplined';
  const isBusiness = profile.borrowerSegment === 'small_business_disciplined';
  const segmentMatches = !bank.segment || bank.segment === 'GENERAL' || (bank.segment === 'GIG' && isGig) || (bank.segment === 'BUSINESS' && isBusiness);
  const bureauPremium = profile.creditScore === 0
    ? 0
    : Math.max(0, 720 - profile.creditScore) * (highAppetite ? 0.018 : 0.012);
  const premium = profile.cashflowRiskScore * (highAppetite ? 0.055 : 0.025) + bureauPremium;
  const marketBenchmark = isBusiness ? 14 : 18;
  const disciplinedThinFile = profile.creditScore === 0 && profile.cashflowRiskScore <= 30;
  const specialistMatch = (bank.segment === 'GIG' && isGig) || (bank.segment === 'BUSINESS' && isBusiness);
  const thinFileCeiling = marketBenchmark - (specialistMatch ? 2 : 1.5);
  const rate = Number((disciplinedThinFile ? Math.min(bank.baseRate + premium, thinFileCeiling) : bank.baseRate + premium).toFixed(2));
  const fixedObligations = profile.fixedMonthlyObligations || 0;
  const currentDti = fixedObligations / Math.max(profile.monthlyIncome, 1);
  const candidateTenures = Array.from(new Set([profile.tenureMonths, 12, 18, 24, 36, 48, 60, 72]))
    .filter((tenure) => tenure >= profile.tenureMonths && tenure <= bank.maxTenure)
    .sort((a, b) => a - b);
  const offeredTenure = bank.maxDti === null ? profile.tenureMonths : candidateTenures.find(
    (tenure) => (fixedObligations + emi(profile.requiredAmount, rate, tenure)) / Math.max(profile.monthlyIncome, 1) <= bank.maxDti!,
  );
  const projectedDti = offeredTenure ? (fixedObligations + emi(profile.requiredAmount, rate, offeredTenure)) / Math.max(profile.monthlyIncome, 1) : currentDti;
  const approved = segmentMatches && offeredTenure !== undefined && (highAppetite
    ? ((profile.creditScore >= 420) || (profile.creditScore === 0 && profile.cashflowRiskScore <= 35))
    : bank.riskAppetite === 'BALANCED'
      ? (profile.creditScore >= 610 || profile.creditScore === 0) && profile.cashflowRiskScore <= 35
      : profile.creditScore >= 720);
  const reason = bank.riskAppetite === 'CONSERVATIVE'
    ? 'bureau-only policy'
    : profile.creditScore === 0
      ? 'progressive cashflow underwriting for a no-history borrower'
      : `${bank.riskAppetite.toLowerCase()} cashflow policy`;
  const tenureRemark = offeredTenure && offeredTenure !== profile.tenureMonths ? `; tenure extended from ${profile.tenureMonths} to ${offeredTenure} months to meet ${(bank.maxDti || 0) * 100}% DTI` : '';
  return { approved, rate, feePercent: bank.feePercent, offeredTenure: offeredTenure || profile.tenureMonths, currentDti, projectedDti, maxDti: bank.maxDti, reason: approved ? `${reason} matched${tenureRemark}` : `${reason} not met${offeredTenure ? '' : `; no tenure up to ${bank.maxTenure} months meets DTI policy`}` };
};

const toNativeFallback = (bank: BankPolicy, decision: ReturnType<typeof localDecision>, profile: StandardBorrowerProfile) => {
  const monthlyEmi = Math.round(emi(profile.requiredAmount, decision.rate, decision.offeredTenure));
  const total = Math.round(monthlyEmi * decision.offeredTenure + profile.requiredAmount * decision.feePercent / 100);
  if (bank.id === 'lender_01') return { TX_STATUS: decision.approved ? 'APRVD' : 'REJTD', RATE_ANN_PCT: decision.rate, EMI_EST_MO_VAL: monthlyEmi, FE_PROC_VAL: profile.requiredAmount * decision.feePercent / 100, OUTFLOW_TOT_VAL: total };
  if (bank.id === 'lender_02') return { decisioning: { verdict: decision.approved ? 'ELIGIBLE' : 'INELIGIBLE', pricing: decision.approved ? { aprPercent: decision.rate, monthlyPayment: monthlyEmi, originationCharge: decision.feePercent, aggregateOutflow: total } : undefined } };
  if (bank.id === 'lender_03') return { DEC_CODE: decision.approved ? 'A01' : 'R01', INT_R: decision.rate, M_EMI: monthlyEmi, PF_PCT: decision.feePercent, TOT_PAY: total };
  return { decision: decision.approved ? 'APPROVED' : 'REJECTED', annualRate: decision.rate, processingFeePercent: decision.feePercent };
};

const bankPayload = (bank: BankPolicy, profile: StandardBorrowerProfile) => bank.id === 'lender_01' || bank.id === 'lender_02' || bank.id === 'lender_03'
  ? BankSchemaAdapter.toBankRequestPayload(bank.id, profile)
  : { applicant: { creditScore: profile.creditScore, monthlyIncome: profile.monthlyIncome, monthlyExpense: profile.monthlyExpense, fixedMonthlyObligations: profile.fixedMonthlyObligations || 0, cashflowRiskScore: profile.cashflowRiskScore, segment: profile.borrowerSegment }, loan: { amount: profile.requiredAmount, tenureMonths: profile.tenureMonths } };

const normalize = (bank: BankPolicy, response: any, principal: number) => bank.id === 'lender_01' || bank.id === 'lender_02' || bank.id === 'lender_03'
  ? BankSchemaAdapter.toStandardBid(bank.id, response, principal)
  : { status: response.decision === 'APPROVED' ? 'Approved' : 'Rejected', interestRate: response.annualRate || 0, emi: 0, feePercent: response.processingFeePercent || 0, totalPayout: 0 };

export async function runReverseAuction(profile: StandardBorrowerProfile): Promise<LoanBid[]> {
  const wiremockBaseUrl = process.env.WIREMOCK_BASE_URL || 'http://localhost:8080';
  const timeoutMs = Number(process.env.BANK_RESPONSE_TIMEOUT_MS || 1800);
  const bids = await Promise.all(BANKS.map(async (bank): Promise<LoanBid> => {
    const decision = localDecision(bank, profile);
    let nativeResponse: unknown;
    let source = 'WireMock';
    try {
      const response = await fetch(`${wiremockBaseUrl}${bank.path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-correlation-id': crypto.randomUUID() }, body: JSON.stringify(bankPayload(bank, profile)), signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      nativeResponse = await response.json();
    } catch {
      source = 'deterministic local fallback';
      nativeResponse = toNativeFallback(bank, decision, profile);
    }
    const normalized = normalize(bank, nativeResponse, profile.requiredAmount);
    const approved = normalized.status === 'Approved' && decision.approved;
    const monthlyPayment = approved ? Math.round(emi(profile.requiredAmount, normalized.interestRate, decision.offeredTenure)) : 0;
    const totalPayout = approved ? Math.round(monthlyPayment * decision.offeredTenure + profile.requiredAmount * normalized.feePercent / 100) : 0;
    const marketBenchmarkRate = profile.borrowerSegment === 'small_business_disciplined' ? 14 : 18;
    return {
      id: `bid_${bank.id}_${crypto.randomUUID()}`, offerId: `offer_${bank.id}_${crypto.randomUUID()}`, lenderId: bank.id, lenderName: bank.name,
      baseInterestRate: approved ? normalized.interestRate : 0, processingFeePercent: approved ? normalized.feePercent : 0,
      calculatedAPR: approved ? calculateTrueAPR(normalized.interestRate, normalized.feePercent, decision.offeredTenure) : 0,
      monthlyEMI: monthlyPayment, totalPayout, rank: 999,
      status: approved ? 'Approved' : 'Rejected', validUntil: new Date(Date.now() + 15 * 60_000).toISOString(),
      riskTier: profile.cashflowRiskScore >= 65 ? 'HIGH' : profile.cashflowRiskScore >= 36 ? 'MEDIUM' : 'LOW',
      lenderCommissionPercent: bank.commissionPercent, marketBenchmarkRate, marketDiscountPercent: approved ? Number((marketBenchmarkRate - normalized.interestRate).toFixed(2)) : 0,
      requestedTenureMonths: profile.tenureMonths, offeredTenureMonths: decision.offeredTenure,
      currentDtiPercent: Number((decision.currentDti * 100).toFixed(2)), projectedDtiPercent: Number((decision.projectedDti * 100).toFixed(2)), maxDtiPercent: decision.maxDti === null ? null : decision.maxDti * 100,
      decisionReason: `${decision.reason}; response source: ${source}`,
    };
  }));
  const approved = bids.filter((bid) => bid.status === 'Approved').sort((a, b) => a.calculatedAPR - b.calculatedAPR);
  approved.forEach((bid, index) => { bid.rank = index + 1; });
  return [...approved, ...bids.filter((bid) => bid.status === 'Rejected')];
}
