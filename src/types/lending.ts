export interface BorrowerProfile {
  id: string;
  fullName: string;
  creditScore: number;
  requiredAmount: number; // in INR
  tenureMonths: number;
  createdAt: Date;
}

export interface LoanBid {
  id: string;
  lenderName: string;
  lenderLogo?: string;
  baseInterestRate: number; // in percent, e.g., 12.49
  processingFeePercent: number; // in percent, e.g., 2.00
  calculatedAPR: number; // true APR
  monthlyEMI: number; // in INR
  totalPayout: number; // in INR
  rank: number; // 1 = lowest APR (best)
}

export interface AuctionRequest {
  borrowerId: string;
  amount: number;
  tenure: number;
  creditScore: number;
}

export interface AuctionResponse {
  borrowerId: string;
  borrowerName: string;
  requestedAmount: number;
  tenure: number;
  bids: LoanBid[];
}
