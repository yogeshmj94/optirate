import { useState, useCallback } from 'react';
import { BorrowerProfile, AuctionResponse } from '@/types/lending';
import { runReverseAuction } from '@/services/auctionService';

// We use Omit to remove the mandatory database-driven keys ('id' and 'createdAt')
// and then declare them as optional so they are not required during form submission.
export type ExtendedBorrowerProfile = Omit<BorrowerProfile, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: string;
  monthlyIncome?: number;
  monthlyExpense?: number;
};

export type AuctionState = 'idle' | 'loading' | 'success' | 'error';

export interface AuctionStateData {
  state: AuctionState;
  profile: ExtendedBorrowerProfile | null;
  auctionResult: AuctionResponse | null;
  error: string | null;
  loadingSteps: string[];
  currentStep: number;
}

const LOADING_STEPS = [
  'Securing connection to Multi-Lender Engine...',
  'Fetching Account Aggregator Bank Data...',
  'Parsing Risk Profile...',
  'Broadcasting Anonymized Profile to 10 Partner Lenders...',
];

export const useAuctionState = () => {
  const [stateData, setStateData] = useState<AuctionStateData>({
    state: 'idle',
    profile: null,
    auctionResult: null,
    error: null,
    loadingSteps: LOADING_STEPS,
    currentStep: 0,
  });

  const submitAuction = useCallback(
    async (profile: ExtendedBorrowerProfile) => {
      setStateData((prev) => ({
        ...prev,
        state: 'loading',
        profile,
        currentStep: 0,
        error: null,
      }));

      // Simulate step-by-step progress feedback
      const stepInterval = setInterval(() => {
        setStateData((prev) => {
          const nextStep = prev.currentStep + 1;
          if (nextStep >= LOADING_STEPS.length) {
            clearInterval(stepInterval);
            return prev;
          }
          return { ...prev, currentStep: nextStep };
        });
      }, 1000);

      try {
        // Pass the captured cash-flow parameters directly into the scoring service
        const bids = await runReverseAuction({
          fullName: profile.fullName,
          requiredAmount: profile.requiredAmount,
          tenureMonths: profile.tenureMonths,
          creditScore: profile.creditScore,
          monthlyIncome: profile.monthlyIncome ?? 100000,
          monthlyExpense: profile.monthlyExpense ?? 30000,
          fixedMonthlyObligations: 0,
          cashflowRiskScore: 0,
          cashflowRiskAction: 'ALLOW_AUCTION',
          borrowerSegment: 'unspecified',
        });

        // Map the results back to the standard UI model
        const result: AuctionResponse = {
          borrowerId: profile.id || `borrower_${Date.now()}`,
          borrowerName: profile.fullName,
          requestedAmount: profile.requiredAmount,
          tenure: profile.tenureMonths,
          bids: bids,
        };

        clearInterval(stepInterval);

        setStateData((prev) => ({
          ...prev,
          state: 'success',
          auctionResult: result,
          currentStep: LOADING_STEPS.length,
        }));
      } catch (err) {
        clearInterval(stepInterval);
        const errorMessage = err instanceof Error ? err.message : 'Auction failed';
        setStateData((prev) => ({
          ...prev,
          state: 'error',
          error: errorMessage,
        }));
      }
    },
    []
  );

  const reset = useCallback(() => {
    setStateData({
      state: 'idle',
      profile: null,
      auctionResult: null,
      error: null,
      loadingSteps: LOADING_STEPS,
      currentStep: 0,
    });
  }, []);

  return {
    ...stateData,
    submitAuction,
    reset,
  };
};
