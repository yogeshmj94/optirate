import { LoanBid, AuctionResponse } from '@/types/lending';
import { calculateAPRAndEMI } from '@/lib/aprCalculator';

/**
 * Mock Lender Data
 * Represents 12 partner lenders with varying strategies
 */
const mockLenders = [
  {
    id: 'lender_001',
    name: 'HDFC Bank',
    logo: '🏦',
    baseRates: { excellent: 8.5, good: 9.5, prime: 10.5 },
    processingFeeRange: [1.5, 2.5],
  },
  {
    id: 'lender_002',
    name: 'ICICI Bank',
    logo: '🏦',
    baseRates: { excellent: 8.75, good: 9.75, prime: 10.75 },
    processingFeeRange: [1.75, 2.75],
  },
  {
    id: 'lender_003',
    name: 'Axis Bank',
    logo: '🏦',
    baseRates: { excellent: 8.9, good: 9.9, prime: 10.9 },
    processingFeeRange: [1.5, 2.5],
  },
  {
    id: 'lender_004',
    name: 'Kotak Mahindra Bank',
    logo: '🏦',
    baseRates: { excellent: 9.0, good: 10.0, prime: 11.0 },
    processingFeeRange: [2.0, 3.0],
  },
  {
    id: 'lender_005',
    name: 'Yes Bank',
    logo: '🏦',
    baseRates: { excellent: 9.25, good: 10.25, prime: 11.25 },
    processingFeeRange: [1.75, 2.75],
  },
  {
    id: 'lender_006',
    name: 'IDFC First Bank',
    logo: '🏦',
    baseRates: { excellent: 8.6, good: 9.6, prime: 10.6 },
    processingFeeRange: [1.5, 2.5],
  },
  {
    id: 'lender_007',
    name: 'Federal Bank',
    logo: '🏦',
    baseRates: { excellent: 9.1, good: 10.1, prime: 11.1 },
    processingFeeRange: [2.0, 3.0],
  },
  {
    id: 'lender_008',
    name: 'RBL Bank',
    logo: '🏦',
    baseRates: { excellent: 9.3, good: 10.3, prime: 11.3 },
    processingFeeRange: [2.25, 3.25],
  },
  {
    id: 'lender_009',
    name: 'Bajaj Finance',
    logo: '💰',
    baseRates: { excellent: 10.0, good: 11.0, prime: 12.0 },
    processingFeeRange: [1.0, 2.0],
  },
  {
    id: 'lender_010',
    name: 'HDFC Finance',
    logo: '💰',
    baseRates: { excellent: 10.25, good: 11.25, prime: 12.25 },
    processingFeeRange: [1.5, 2.5],
  },
  {
    id: 'lender_011',
    name: 'Flex Finance',
    logo: '💰',
    baseRates: { excellent: 11.0, good: 12.0, prime: 13.0 },
    processingFeeRange: [2.0, 3.0],
  },
  {
    id: 'lender_012',
    name: 'Digital Credit Co.',
    logo: '📱',
    baseRates: { excellent: 9.5, good: 10.5, prime: 11.5 },
    processingFeeRange: [0.5, 1.5],
  },
];

/**
 * Determine credit tier based on score
 */
const getCreditTier = (creditScore: number): 'excellent' | 'good' | 'prime' => {
  if (creditScore >= 750) return 'excellent';
  if (creditScore >= 700) return 'good';
  return 'prime';
};

/**
 * Generate mock bids for an auction request
 * Simulates competitive bidding from lenders
 */
export const generateMockBids = (
  borrowerId: string,
  loanAmount: number,
  tenureMonths: number,
  creditScore: number
): LoanBid[] => {
  const tier = getCreditTier(creditScore);
  const bids: LoanBid[] = [];

  // Generate bids from all lenders with some randomness
  mockLenders.forEach((lender) => {
    const baseRate = lender.baseRates[tier];
    const feeMin = lender.processingFeeRange[0];
    const feeMax = lender.processingFeeRange[1];
    
    // Add slight randomness to simulate competitive bidding
    const rateVariation = (Math.random() - 0.5) * 0.5; // ±0.25%
    const feeVariation = Math.random() * (feeMax - feeMin) + feeMin;
    const adjustedBaseRate = baseRate + rateVariation;
    
    const calculation = calculateAPRAndEMI({
      baseInterestRate: adjustedBaseRate,
      processingFeePercent: feeVariation,
      loanAmount,
      tenureMonths,
    });
    
    bids.push({
      id: `bid_${lender.id}_${borrowerId}`,
      lenderName: lender.name,
      lenderLogo: lender.logo,
      baseInterestRate: parseFloat(adjustedBaseRate.toFixed(2)),
      processingFeePercent: parseFloat(feeVariation.toFixed(2)),
      calculatedAPR: calculation.calculatedAPR,
      monthlyEMI: calculation.monthlyEMI,
      totalPayout: calculation.totalPayout,
      rank: 0, // Will be set after sorting
    });
  });

  // Sort by APR (lowest first = best for borrower)
  bids.sort((a, b) => a.calculatedAPR - b.calculatedAPR);

  // Assign ranks
  bids.forEach((bid, index) => {
    bid.rank = index + 1;
  });

  return bids;
};

/**
 * Simulate complete auction response with delay
 * Creates immersion by taking 4-5 seconds
 */
export const simulateAuctionRequest = async (
  borrowerId: string,
  borrowerName: string,
  loanAmount: number,
  tenureMonths: number,
  creditScore: number
): Promise<AuctionResponse> => {
  // Simulate network delay: 4-5 seconds for immersion
  const delayMs = 4000 + Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  const bids = generateMockBids(
    borrowerId,
    loanAmount,
    tenureMonths,
    creditScore
  );

  return {
    borrowerId,
    borrowerName,
    requestedAmount: loanAmount,
    tenure: tenureMonths,
    bids,
  };
};

/**
 * Get a prime test profile for pre-filling
 */
export const getPrimeTestProfile = () => ({
  fullName: 'Amit Sharma',
  creditScore: 783,
  requiredAmount: 500000,
  tenureMonths: 60,
});
