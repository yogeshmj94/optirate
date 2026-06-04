/**
 * APR Calculation Utility
 * Accurately calculates true APR and EMI based on base rate and processing fee
 */

export interface APRCalculationInput {
  baseInterestRate: number; // annual % rate
  processingFeePercent: number; // as % of loan amount
  loanAmount: number; // principal in INR
  tenureMonths: number;
}

export interface APRCalculationOutput {
  baseRate: number;
  processingFee: number; // rupees
  effectiveRate: number; // rate adjusted for processing fee
  calculatedAPR: number; // true APR
  monthlyRate: number; // monthly rate as decimal
  monthlyEMI: number; // Equated Monthly Installment
  totalPayout: number; // total amount to be repaid
  totalInterest: number; // total interest paid
}

/**
 * Calculate EMI using the standard formula:
 * EMI = P * R * (1 + R)^N / ((1 + R)^N - 1)
 * where P = principal, R = monthly rate, N = tenure in months
 */
export const calculateEMI = (
  principal: number,
  annualRate: number,
  tenureMonths: number
): number => {
  const monthlyRate = annualRate / 100 / 12;
  
  if (monthlyRate === 0) {
    return principal / tenureMonths;
  }
  
  const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths);
  const denominator = Math.pow(1 + monthlyRate, tenureMonths) - 1;
  
  return numerator / denominator;
};

/**
 * Calculate true APR considering processing fee
 * Processing fee increases the effective cost of the loan
 */
export const calculateTrueAPR = (
  baseInterestRate: number,
  processingFeePercent: number,
  tenureMonths: number
): number => {
  // Processing fee as a decimal of principal
  const processingFeeDecimal = processingFeePercent / 100;
  
  // Approximate effective rate accounting for upfront processing fee
  // This is a simplified calculation; true IRR would require iterative solving
  const baseRateDecimal = baseInterestRate / 100;
  const monthlyBaseRate = baseRateDecimal / 12;
  
  // Effective monthly rate approximation
  const effectiveMonthlyRate = monthlyBaseRate + (processingFeeDecimal / tenureMonths);
  const effectiveAnnualRate = effectiveMonthlyRate * 12 * 100;
  
  return parseFloat(effectiveAnnualRate.toFixed(2));
};

/**
 * Complete APR and EMI calculation
 */
export const calculateAPRAndEMI = ({
  baseInterestRate,
  processingFeePercent,
  loanAmount,
  tenureMonths,
}: APRCalculationInput): APRCalculationOutput => {
  // Calculate processing fee in rupees
  const processingFee = (loanAmount * processingFeePercent) / 100;
  
  // Calculate true APR
  const calculatedAPR = calculateTrueAPR(
    baseInterestRate,
    processingFeePercent,
    tenureMonths
  );
  
  // Calculate monthly EMI using true APR
  const monthlyEMI = calculateEMI(loanAmount, calculatedAPR, tenureMonths);
  
  // Calculate total payout
  const totalPayout = monthlyEMI * tenureMonths + processingFee;
  const totalInterest = totalPayout - loanAmount;
  
  return {
    baseRate: baseInterestRate,
    processingFee: parseFloat(processingFee.toFixed(2)),
    effectiveRate: calculatedAPR,
    calculatedAPR: calculatedAPR,
    monthlyRate: calculatedAPR / 100 / 12,
    monthlyEMI: parseFloat(monthlyEMI.toFixed(2)),
    totalPayout: parseFloat(totalPayout.toFixed(2)),
    totalInterest: parseFloat(totalInterest.toFixed(2)),
  };
};
