export interface LoanApplicationSubmission {
  amount: number;
  tenureMonths: number;
  lenderId: string;
  interestRate: number;
  borrowerId?: string;
  aaConsentId?: string;
}

export function isLoanApplicationSubmission(value: unknown): value is LoanApplicationSubmission {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.amount === 'number' &&
    body.amount > 0 &&
    typeof body.tenureMonths === 'number' &&
    Number.isInteger(body.tenureMonths) &&
    body.tenureMonths > 0 &&
    typeof body.lenderId === 'string' &&
    typeof body.interestRate === 'number'
  );
}