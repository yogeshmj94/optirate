import type { Transaction } from './riskEngine';

export type MockAAProfileId = 'prime_clean' | 'high_score_stressed' | 'standard_average' | 'defaulter_chaotic' | 'thin_file_clean' | 'gig_worker_disciplined' | 'small_business_disciplined';
export type MockAATransaction = Transaction & { type: 'CREDIT' | 'DEBIT'; amount: number; narration: string; balance: number };

export interface MockAAProfile {
  id: MockAAProfileId;
  label: string;
  description: string;
  cashflowBehaviour: 'CLEAN' | 'AVERAGE' | 'STRESSED' | 'CHAOTIC';
  bureauStatus: 'HIGH' | 'HIGH_STRESSED' | 'MEDIUM' | 'LOW_DEFAULTER' | 'NO_HISTORY' | 'NO_HISTORY_GIG' | 'NO_HISTORY_BUSINESS';
  creditScore: number;
  recommendedPan: 'ABCDE1234A';
  account: { fip: string; accountType: 'SAVINGS'; maskedAccountNumber: string; statementMonths: 6 };
}

export const MOCK_AA_PROFILES: MockAAProfile[] = [
  { id: 'prime_clean', label: 'Prime salaried', description: 'Stable salary, controlled expenses, no bounced obligations.', cashflowBehaviour: 'CLEAN', bureauStatus: 'HIGH', creditScore: 790, recommendedPan: 'ABCDE1234A', account: { fip: 'Setu Sandbox Bank — Prime', accountType: 'SAVINGS', maskedAccountNumber: '•••• 1101', statementMonths: 6 } },
  { id: 'high_score_stressed', label: 'High-score but stressed', description: 'Strong bureau score masked by friends/family borrowing and petrol-pump credit-card evergreening.', cashflowBehaviour: 'STRESSED', bureauStatus: 'HIGH_STRESSED', creditScore: 810, recommendedPan: 'ABCDE1234A', account: { fip: 'Setu Sandbox Bank — Evergreening', accountType: 'SAVINGS', maskedAccountNumber: '•••• 5505', statementMonths: 6 } },
  { id: 'standard_average', label: 'Average salaried', description: 'Regular income with moderate discretionary spending and existing EMI.', cashflowBehaviour: 'AVERAGE', bureauStatus: 'MEDIUM', creditScore: 675, recommendedPan: 'ABCDE1234A', account: { fip: 'Setu Sandbox Bank — Standard', accountType: 'SAVINGS', maskedAccountNumber: '•••• 2202', statementMonths: 6 } },
  { id: 'defaulter_chaotic', label: 'Stressed / defaulter', description: 'Irregular credits, rapid cash sweeps, deficits and missed-payment charges.', cashflowBehaviour: 'CHAOTIC', bureauStatus: 'LOW_DEFAULTER', creditScore: 510, recommendedPan: 'ABCDE1234A', account: { fip: 'Setu Sandbox Bank — Stressed', accountType: 'SAVINGS', maskedAccountNumber: '•••• 3303', statementMonths: 6 } },
  { id: 'thin_file_clean', label: 'New-to-credit', description: 'No bureau history, but six months of clean and stable salary cashflow.', cashflowBehaviour: 'CLEAN', bureauStatus: 'NO_HISTORY', creditScore: 0, recommendedPan: 'ABCDE1234A', account: { fip: 'Setu Sandbox Bank — Thin File', accountType: 'SAVINGS', maskedAccountNumber: '•••• 4404', statementMonths: 6 } },
  { id: 'gig_worker_disciplined', label: 'Disciplined gig worker', description: 'No bureau history and variable platform earnings, with positive savings in every statement month.', cashflowBehaviour: 'CLEAN', bureauStatus: 'NO_HISTORY_GIG', creditScore: 0, recommendedPan: 'ABCDE1234A', account: { fip: 'Setu Sandbox Bank — Gig Worker', accountType: 'SAVINGS', maskedAccountNumber: '•••• 6606', statementMonths: 6 } },
  { id: 'small_business_disciplined', label: 'Disciplined small business', description: 'No bureau history and seasonal business receipts, with controlled operating costs and monthly surplus.', cashflowBehaviour: 'CLEAN', bureauStatus: 'NO_HISTORY_BUSINESS', creditScore: 0, recommendedPan: 'ABCDE1234A', account: { fip: 'Setu Sandbox Bank — Small Business', accountType: 'SAVINGS', maskedAccountNumber: '•••• 7707', statementMonths: 6 } },
];

const iso = (monthOffset: number, day: number, hour = 9) => {
  const date = new Date(Date.UTC(2026, 7 - monthOffset, day, hour));
  return date.toISOString();
};

export function buildSixMonthStatement(profileId: MockAAProfileId): MockAATransaction[] {
  const profile = MOCK_AA_PROFILES.find((item) => item.id === profileId) || MOCK_AA_PROFILES[0];
  let balance = profileId === 'defaulter_chaotic' ? 12000 : 45000;
  const transactions: MockAATransaction[] = [];
  const add = (month: number, day: number, hour: number, direction: Transaction['direction'], amount: number, category: string, source: string, narration: string) => {
    balance += direction === 'INFLOW' ? amount : -amount;
    transactions.push({ id: `${profile.id}-${month}-${transactions.length + 1}`, timestamp: iso(month, day, hour), direction, grossAmount: amount, counterpartyEntityHash: source, category, type: direction === 'INFLOW' ? 'CREDIT' : 'DEBIT', amount, narration, balance: Math.round(balance) });
  };

  for (let month = 5; month >= 0; month -= 1) {
    if (profileId === 'prime_clean' || profileId === 'thin_file_clean') {
      add(month, 1, 9, 'INFLOW', profileId === 'prime_clean' ? 145000 : 85000, 'SALARY', 'EMPLOYER_STABLE_HASH', 'Monthly salary credit');
      add(month, 3, 10, 'OUTFLOW', 28000, 'UPI', 'LANDLORD_HASH', 'House rent');
      add(month, 7, 11, 'OUTFLOW', profileId === 'prime_clean' ? 14000 : 0, 'EMI', 'LENDER_EMI_HASH', profileId === 'prime_clean' ? 'Existing loan EMI' : 'No existing EMI');
      add(month, 12, 18, 'OUTFLOW', 9000, 'BILL_PAYMENT', 'UTILITY_HASH', 'Utilities and insurance');
      add(month, 18, 13, 'OUTFLOW', 15000, 'UPI', 'HOUSEHOLD_HASH', 'Groceries and household');
      add(month, 24, 20, 'OUTFLOW', 8000, 'UPI', 'DISCRETIONARY_HASH', 'Discretionary spend');
    } else if (profileId === 'gig_worker_disciplined') {
      const monthlyIncome = [72000, 105000, 68000, 98000, 76000, 112000][5 - month];
      const monthlyExpense = [48000, 62000, 46000, 61000, 50000, 68000][5 - month];
      add(month, 4, 10, 'INFLOW', Math.round(monthlyIncome * 0.58), 'GIG_PLATFORM_PAYOUT', 'GIG_PLATFORM_A_HASH', 'Weekly gig-platform payout aggregate');
      add(month, 19, 16, 'INFLOW', Math.round(monthlyIncome * 0.42), 'GIG_PLATFORM_PAYOUT', 'GIG_PLATFORM_B_HASH', 'Second gig-platform payout aggregate');
      add(month, 7, 11, 'OUTFLOW', Math.round(monthlyExpense * 0.35), 'UPI', 'LANDLORD_HASH', 'Rent and workspace contribution');
      add(month, 12, 18, 'OUTFLOW', Math.round(monthlyExpense * 0.2), 'BILL_PAYMENT', 'UTILITY_HASH', 'Utilities, mobile and insurance');
      add(month, 21, 13, 'OUTFLOW', Math.round(monthlyExpense * 0.3), 'UPI', 'HOUSEHOLD_HASH', 'Household and fuel spend');
      add(month, 27, 20, 'OUTFLOW', Math.round(monthlyExpense * 0.15), 'UPI', 'DISCRETIONARY_HASH', 'Discretionary spending');
    } else if (profileId === 'small_business_disciplined') {
      const monthlyIncome = [130000, 175000, 120000, 190000, 145000, 210000][5 - month];
      const monthlyExpense = [82000, 108000, 78000, 118000, 90000, 126000][5 - month];
      add(month, 3, 11, 'INFLOW', Math.round(monthlyIncome * 0.45), 'BUSINESS_RECEIPT', 'RECURRING_CUSTOMERS_HASH', 'Customer UPI collections');
      add(month, 16, 17, 'INFLOW', Math.round(monthlyIncome * 0.35), 'BUSINESS_RECEIPT', 'POS_SETTLEMENT_HASH', 'Card/POS settlement');
      add(month, 25, 14, 'INFLOW', Math.round(monthlyIncome * 0.2), 'BUSINESS_RECEIPT', 'MARKETPLACE_SETTLEMENT_HASH', 'Marketplace settlement');
      add(month, 6, 10, 'OUTFLOW', Math.round(monthlyExpense * 0.28), 'BUSINESS_EXPENSE', 'SHOP_RENT_HASH', 'Shop rent');
      add(month, 11, 15, 'OUTFLOW', Math.round(monthlyExpense * 0.42), 'BUSINESS_EXPENSE', 'SUPPLIER_HASH', 'Inventory and supplier payments');
      add(month, 20, 12, 'OUTFLOW', Math.round(monthlyExpense * 0.2), 'BUSINESS_EXPENSE', 'STAFF_PAYROLL_HASH', 'Staff wages');
      add(month, 28, 18, 'OUTFLOW', Math.round(monthlyExpense * 0.1), 'BILL_PAYMENT', 'BUSINESS_UTILITY_HASH', 'Business utilities and tax reserve');
    } else if (profileId === 'high_score_stressed') {
      add(month, 1, 9, 'INFLOW', 80000, 'SALARY', 'EMPLOYER_STABLE_HASH', 'Monthly salary credit');
      add(month, 2, 9, 'INFLOW', 60000, 'CREDIT_CARD_CASH_LIKE', `PETROL_PUMP_POS_${month}`, 'Cash-like petrol pump card settlement (30% of ₹2L limit)');
      add(month, 2, 10, 'OUTFLOW', 60000, 'CREDIT_CARD_PAYMENT', 'CARD_ISSUER_HASH', 'Repayment of previous 30% card withdrawal');
      add(month, 5, 9, 'INFLOW', 45000, 'FRIENDS_FAMILY_TRANSFER', `FRIEND_FAMILY_${month % 3}`, 'Short-term borrowing from friends/family');
      add(month, 5, 10, 'OUTFLOW', 25000, 'EMI', 'LENDER_EMI_HASH', 'EMI paid after friends/family funding');
      add(month, 8, 12, 'OUTFLOW', 20000, 'UPI', 'LANDLORD_HASH', 'House rent');
      add(month, 15, 18, 'OUTFLOW', 7000, 'BILL_PAYMENT', 'UTILITY_HASH', 'Utilities and insurance');
      add(month, 22, 20, 'OUTFLOW', 13000, 'UPI', 'HOUSEHOLD_HASH', 'Household and living spend');
    } else if (profileId === 'standard_average') {
      add(month, 1, 9, 'INFLOW', 95000, 'SALARY', 'EMPLOYER_STABLE_HASH', 'Monthly salary credit');
      const commitmentDay = month % 2 === 0 ? 1 : 3;
      add(month, commitmentDay, 10, 'OUTFLOW', 26000, 'UPI', 'LANDLORD_HASH', 'House rent');
      add(month, commitmentDay, 12, 'OUTFLOW', 18000, 'EMI', 'LENDER_EMI_HASH', 'Consumer loan EMI');
      add(month, commitmentDay, 14, 'OUTFLOW', 10500, 'BILL_PAYMENT', 'UTILITY_HASH', 'Utilities and subscriptions');
      add(month, commitmentDay, 16, 'OUTFLOW', 18000, 'UPI', 'HOUSEHOLD_HASH', 'Household spend');
      add(month, commitmentDay, 18, 'OUTFLOW', month % 2 === 0 ? 30000 : 38000, 'UPI', 'DISCRETIONARY_HASH', 'Travel and discretionary spend');
    } else {
      const inflow = month % 2 === 0 ? 72000 : 54000;
      add(month, 1, 9, 'INFLOW', inflow, 'UPI', `IRREGULAR_SOURCE_${month % 3}`, 'Irregular business receipt');
      add(month, 1, 11, 'OUTFLOW', Math.round(inflow * 0.72), 'CASH_WITHDRAWAL', 'CASH_SWEEP_HASH', 'Immediate cash withdrawal');
      add(month, 1, 15, 'OUTFLOW', Math.round(inflow * 0.18), 'UNCATEGORIZED_TRANSFER', 'UNKNOWN_TRANSFER_HASH', 'Uncategorised transfer');
      add(month, 5, 10, 'OUTFLOW', 22000, 'EMI', 'OVERDUE_LENDER_HASH', 'Overdue EMI collection');
      add(month, 10, 12, 'OUTFLOW', 18000, 'UPI', 'LANDLORD_HASH', 'Rent payment');
      add(month, 15, 16, 'OUTFLOW', 4500, 'BILL_PAYMENT', 'PENALTY_HASH', 'Bounce and late payment charges');
    }
  }
  return transactions.filter((transaction) => transaction.grossAmount > 0);
}

export function getMockAAProfile(profileId: string | undefined): MockAAProfile {
  return MOCK_AA_PROFILES.find((profile) => profile.id === profileId) || MOCK_AA_PROFILES[0];
}
