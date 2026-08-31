export interface BorrowerProfile {
  id: string;
  fullName: string;
  creditScore: number;
  requiredAmount: number; // in INR
  tenureMonths: number;
  createdAt: Date;
}

export interface Lender {
  id: string;
  name: string;
  type: 'Bank' | 'NBFC' | 'Digital';
  baseRate: number; // The absolute minimum they will offer
  processingFeePercent: number;
  approvalProbability: number; // For mocking realistic rejections
}

export interface LoanBid {
  id: string; // Match your existing requirement
  lenderId: string; // Good for tracking which lender won
  lenderName: string;
  lenderLogo?: string;
  baseInterestRate: number; 
  processingFeePercent: number; 
  calculatedAPR: number; // True APR
  monthlyEMI: number; 
  totalPayout: number; 
  rank: number; // 1 = lowest APR (best)
  status: 'Approved' | 'Rejected';
  offerId?: string;
  validUntil?: string;
  decisionReason?: string;
  riskTier?: 'LOW' | 'MEDIUM' | 'HIGH';
  platformFeePercent?: number;
  marketBenchmarkRate?: number;
  marketDiscountPercent?: number;
  requestedTenureMonths?: number;
  offeredTenureMonths?: number;
  currentDtiPercent?: number;
  projectedDtiPercent?: number;
  maxDtiPercent?: number | null;
}

export interface AuctionRequest {
  borrowerId: string;
  amount: number;
  tenure: number;
  creditScore: number;
  fullName: string;
  monthlyIncome: number;
  monthlyExpense: number;
  fixedMonthlyObligations: number;
  cashflowRiskScore: number;
  cashflowRiskAction: 'ALLOW_AUCTION' | 'REVIEW' | 'BLOCK_AUCTION';
  borrowerSegment?: string;
}

export interface AuctionResponse {
  borrowerId: string;
  borrowerName: string;
  requestedAmount: number;
  tenure: number;
  bids: LoanBid[];
}
