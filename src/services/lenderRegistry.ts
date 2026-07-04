import { Lender } from '../types/lending';

// You will eventually replace this mock data with a database query or external API call.
export const MOCK_LENDERS: Lender[] = [
  { id: 'lender_01', name: 'HDFC Bank', type: 'Bank', baseRate: 10.5, processingFeePercent: 1.0, approvalProbability: 0.8 },
  { id: 'lender_02', name: 'ICICI Bank', type: 'Bank', baseRate: 10.75, processingFeePercent: 0.8, approvalProbability: 0.75 },
  { id: 'lender_03', name: 'Navi Finserv', type: 'Digital', baseRate: 9.9, processingFeePercent: 0.0, approvalProbability: 0.6 },
  { id: 'lender_04', name: 'Bajaj Finance', type: 'NBFC', baseRate: 11.0, processingFeePercent: 1.5, approvalProbability: 0.9 },
  { id: 'lender_05', name: 'IDFC First Bank', type: 'Bank', baseRate: 10.25, processingFeePercent: 0.5, approvalProbability: 0.85 },
  { id: 'lender_06', name: 'Tata Capital', type: 'NBFC', baseRate: 10.9, processingFeePercent: 1.2, approvalProbability: 0.88 },
  { id: 'lender_07', name: 'KreditBee', type: 'Digital', baseRate: 14.0, processingFeePercent: 2.0, approvalProbability: 0.95 },
  { id: 'lender_08', name: 'Axis Bank', type: 'Bank', baseRate: 10.6, processingFeePercent: 1.0, approvalProbability: 0.7 },
  { id: 'lender_09', name: 'Aditya Birla', type: 'NBFC', baseRate: 11.2, processingFeePercent: 1.25, approvalProbability: 0.82 },
  { id: 'lender_10', name: 'MoneyTap', type: 'Digital', baseRate: 13.5, processingFeePercent: 1.5, approvalProbability: 0.92 },
];