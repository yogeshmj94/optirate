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