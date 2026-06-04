/**
 * Auction State Machine Hook
 * Manages the lifecycle: Form → Loading → Results
 */

import { useState, useCallback } from 'react';
import { BorrowerProfile, AuctionResponse } from '@/types/lending';
import { simulateAuctionRequest } from '@/services/auctionService';

export type AuctionState = 'idle' | 'loading' | 'success' | 'error';

export interface AuctionStateData {
  state: AuctionState;
  profile: BorrowerProfile | null;
  auctionResult: AuctionResponse | null;
  error: string | null;
  loadingSteps: string[];
  currentStep: number;
}

const LOADING_STEPS = [
  'Securing connection to FinBox Multi-Lender Sandbox Engine...',
  'Fetching Account Aggregator Bank Data...',
  'Parsing Risk Profile...',
  'Broadcasting Anonymized Profile to 12 Partner Lenders...',
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
    async (profile: BorrowerProfile) => {
      setStateData((prev) => ({
        ...prev,
        state: 'loading',
        profile,
        currentStep: 0,
        error: null,
      }));

      // Simulate step-by-step loading
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
        const result = await simulateAuctionRequest(
          `borrower_${Date.now()}`,
          profile.fullName,
          profile.requiredAmount,
          profile.tenureMonths,
          profile.creditScore
        );

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
