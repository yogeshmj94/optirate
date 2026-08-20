export interface LoanApplicationSubmission {
  completionRequestId: string;
  amount: number;
  tenureMonths: number;
  lenderId: string;
  interestRate: number;
  riskScore?: number;
  riskAction?: 'ALLOW_AUCTION' | 'REVIEW' | 'BLOCK_AUCTION';
  riskReasons?: string[];
  borrowerId?: string;
  aaConsentId?: string;
}

export function isLoanApplicationSubmission(value: unknown): value is LoanApplicationSubmission {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.completionRequestId === 'string' && body.completionRequestId.length > 0 && body.completionRequestId.length <= 128 &&
    typeof body.amount === 'number' &&
    body.amount > 0 &&
    typeof body.tenureMonths === 'number' &&
    Number.isInteger(body.tenureMonths) &&
    body.tenureMonths > 0 &&
    typeof body.lenderId === 'string' &&
    typeof body.interestRate === 'number' &&
    (body.riskScore === undefined || (typeof body.riskScore === 'number' && body.riskScore >= 0 && body.riskScore <= 100)) &&
    (body.riskAction === undefined || ['ALLOW_AUCTION', 'REVIEW', 'BLOCK_AUCTION'].includes(body.riskAction as string)) &&
    (body.riskReasons === undefined || (Array.isArray(body.riskReasons) && body.riskReasons.every((reason) => typeof reason === 'string')))
  );
}