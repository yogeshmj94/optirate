'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { evaluateBorrower } from '@/services/riskEngine';
import { buildSixMonthStatement, getMockAAProfile, MOCK_AA_PROFILES, type MockAAProfileId } from '@/services/mockAAProfiles';

// Unified interfaces for our compliant LSP workflow
interface KYCData {
  verification: string;
  data: {
    full_name: string;
    category: string;
    aadhaar_seeding_status: string;
    riskProfile?: {
      behaviour: 'disciplined' | 'chaotic' | 'defaulter';
      score: number;
      action: 'ALLOW_AUCTION' | 'REVIEW' | 'BLOCK_AUCTION';
    };
  };
}

interface BankAccount {
  FIP: string;
  accountType: string;
  balance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  netMonthlyIncome: number;
  fixedMonthlyObligations: number;
}

interface Bid {
  id: string;
  lenderId: string;
  lenderName: string;
  baseInterestRate: number;
  processingFeePercent: number;
  calculatedAPR: number;
  monthlyEMI: number;
  totalPayout: number;
  rank: number;
  status: string;
  lenderCommissionPercent?: number;
  marketBenchmarkRate?: number;
  marketDiscountPercent?: number;
  requestedTenureMonths?: number;
  offeredTenureMonths?: number;
  currentDtiPercent?: number;
  projectedDtiPercent?: number;
  maxDtiPercent?: number | null;
  decisionReason?: string;
}

export default function Home() {
  // Step manager: 1 (KYC/PAN), 2 (Setu AA Consent), 3 (Auction Prep & Broadcast), 4 (Review KFS & eSign), 5 (Success)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1 States (KYC)
  const [pan, setPan] = useState<string>('ABCDE1234A');
  const [kycConsent, setKycConsent] = useState<boolean>(false);
  const [kycResult, setKycResult] = useState<KYCData | null>(null);

  // Step 2 States (Setu AA Consent Webview)
  const [mobileNumber, setMobileNumber] = useState<string>('9999999999');
  const [showAAWebview, setShowAAWebview] = useState<boolean>(false);
  const [webviewStep, setWebviewStep] = useState<'otp' | 'accounts' | 'success'>('otp');
  const [webviewOtp, setWebviewOtp] = useState<string>('123456');
  const [selectedFip, setSelectedFip] = useState<string>('Setu Mock Bank');
  const [selectedProfileId, setSelectedProfileId] = useState<MockAAProfileId>('prime_clean');
  const [linkedBank, setLinkedBank] = useState<BankAccount | null>(null);
  const [consentId, setConsentId] = useState<string | null>(null);

  // Step 3 States (Reverse Auction Broadcast)
  const [requiredAmountInput, setRequiredAmountInput] = useState<string>('');
  const [tenureMonths, setTenureMonths] = useState<number>(36);
  const [creditScore, setCreditScore] = useState<number>(790);
  const [auctionState, setAuctionState] = useState<'idle' | 'broadcasting' | 'completed'>('idle');
  const [auctionStepIndex, setAuctionStepIndex] = useState<number>(0);
  const [bids, setBids] = useState<Bid[]>([]);
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);

  // Step 4 States (KFS & eSign)
  const [showESignModal, setShowESignModal] = useState<boolean>(false);
  const [esignOtp, setEsignOtp] = useState<string>('123456');
  const [esignRequestId, setEsignRequestId] = useState<string | null>(null);
  const [esignMethod, setEsignMethod] = useState<'setu_hosted' | 'simulated_otp' | null>(null);
  const [disbursedTxId, setDisbursedTxId] = useState<string | null>(null);
  const [hostedESignAvailable, setHostedESignAvailable] = useState<boolean>(false);
  const [hostedESignEnvironment, setHostedESignEnvironment] = useState<string>('sandbox');
  const completionRequestId = useRef<string>(crypto.randomUUID());

  const requiredAmount = Number(requiredAmountInput || 0);

  useEffect(() => {
    void fetch('/api/setu/esign', { cache: 'no-store' })
      .then((response) => response.json())
      .then((configuration) => {
        setHostedESignAvailable(configuration.hostedAvailable === true);
        setHostedESignEnvironment(configuration.environment || 'sandbox');
      })
      .catch(() => setHostedESignAvailable(false));
  }, []);

  const riskSummary = useMemo(() => {
    return evaluateBorrower(buildSixMonthStatement(selectedProfileId));
  }, [selectedProfileId]);
  const expectedDtiPercent = useMemo(() => {
    if (!linkedBank || requiredAmount <= 0 || tenureMonths <= 0) return linkedBank ? linkedBank.fixedMonthlyObligations / Math.max(linkedBank.netMonthlyIncome, 1) * 100 : 0;
    const monthlyRate = 16 / 1200;
    const expectedEmi = requiredAmount * monthlyRate * ((1 + monthlyRate) ** tenureMonths) / (((1 + monthlyRate) ** tenureMonths) - 1);
    return (linkedBank.fixedMonthlyObligations + expectedEmi) / Math.max(linkedBank.netMonthlyIncome, 1) * 100;
  }, [linkedBank, requiredAmount, tenureMonths]);

  // Reverse Auction step description logs
  const BROADCAST_LOGS = [
    'Establishing secure LSP connection to regulatory routing gateway...',
    `Layered underwriting: SRI ${riskSummary.score}, action ${riskSummary.action}.`,
    'Broadcasting the application concurrently to 6 WireMock bank underwriting APIs...',
    'Normalizing time-limited pre-approved offers and ranking them by APR...'
  ];

  const handleVerifyPAN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycConsent) {
      setErrorMessage("Please accept the terms to authorize identity verification.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/setu/verify-pan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pan, consent: "Y" })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Identity verification failed.');

      setKycResult(data);
      setCurrentStep(2); // Progress to Bank Consent
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateAAConsent = async () => {
    if (!mobileNumber || mobileNumber.length < 10) {
      setErrorMessage("Please provide a valid 10-digit mobile number.");
      return;
    }
    setErrorMessage(null);

    try {
      const response = await fetch('/api/setu/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'INITIATE', mobileNumber, profileId: selectedProfileId })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to initiate Setu consent');

      setConsentId(data.consentId || null);
      setShowAAWebview(true);
      setWebviewStep('otp');
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleVerifyWebviewOtp = async () => {
    if (webviewOtp !== '123456') {
      setErrorMessage("Invalid test OTP. Use '123456' for Setu Sandbox Simulation.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/setu/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CHECK_STATUS', consentId, profileId: selectedProfileId })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Consent status check failed');

      setSelectedFip(data.linkedAccounts?.[0]?.FIP || selectedFip);
      setWebviewStep('accounts');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteConsentWebview = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const sessionResponse = await fetch('/api/setu/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_SESSION', consentId, profileId: selectedProfileId })
      });
      const sessionData = await sessionResponse.json();
      if (!sessionResponse.ok) throw new Error(sessionData.error || 'Data session creation failed');

      const dataResponse = await fetch('/api/setu/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'FETCH_DATA', sessionId: sessionData.sessionId, profileId: selectedProfileId })
      });
      const data = await dataResponse.json();
      if (!dataResponse.ok) throw new Error(data.error || 'Failed to fetch statement data');

      const income = data.data?.account?.summary?.monthlyIncome || 0;
      const expense = data.data?.account?.summary?.monthlyExpense || 0;

      const mockStatement: BankAccount = {
        FIP: selectedFip,
        accountType: 'SAVINGS',
        balance: data.data?.account?.summary?.balance || 145000,
        monthlyIncome: income,
        monthlyExpense: expense,
        netMonthlyIncome: data.data?.account?.summary?.netMonthlyIncome || income,
        fixedMonthlyObligations: data.data?.account?.summary?.fixedMonthlyObligations || 0,
      };

      setCreditScore(data.data?.profile?.creditScore ?? getMockAAProfile(selectedProfileId).creditScore);
      setLinkedBank(mockStatement);
      setShowAAWebview(false);
      setCurrentStep(3);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerReverseAuction = () => {
    if (!Number.isFinite(requiredAmount) || requiredAmount <= 0) {
      setBids([]);
      setAuctionState('idle');
      setErrorMessage('Enter a loan amount greater than zero before starting the auction.');
      return;
    }

    setErrorMessage(null);
    setBids([]);
    setSelectedBid(null);
    setAuctionState('broadcasting');
    setAuctionStepIndex(0);

    // Simulate stepping through broadcasting stages
    const interval = setInterval(() => {
      setAuctionStepIndex((prev) => {
        if (prev >= BROADCAST_LOGS.length - 1) {
          clearInterval(interval);
          void generateCompetitiveBids();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const generateCompetitiveBids = async () => {
    const income = linkedBank?.monthlyIncome || 120000;
    const expense = linkedBank?.monthlyExpense || 40000;
    try {
      const response = await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: kycResult?.data.full_name || 'Verified borrower', requiredAmount, tenureMonths,
          creditScore, monthlyIncome: income, monthlyExpense: expense,
          fixedMonthlyObligations: linkedBank?.fixedMonthlyObligations || 0,
          cashflowRiskScore: riskSummary.score, cashflowRiskAction: riskSummary.action,
          borrowerSegment: selectedProfileId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to obtain lender offers.');
      setBids(data.bids);
      if (!data.bids.some((bid: Bid) => bid.status === 'Approved')) {
        setErrorMessage('No bank returned a pre-approved offer for this profile.');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to obtain lender offers.');
      setBids([]);
    } finally {
      setAuctionState('completed');
    }
  };

  const handleSelectBid = (bid: Bid) => {
    setSelectedBid(bid);
    setCurrentStep(4); // Advance to KFS screen
  };

  const resetLoanApplication = () => {
    setCurrentStep(1);
    setLoading(false);
    setErrorMessage(null);
    setPan('ABCDE1234A');
    setKycConsent(false);
    setKycResult(null);
    setMobileNumber('9999999999');
    setShowAAWebview(false);
    setWebviewStep('otp');
    setWebviewOtp('123456');
    setSelectedFip('Setu Mock Bank');
    setSelectedProfileId('prime_clean');
    setLinkedBank(null);
    setConsentId(null);
    setRequiredAmountInput('');
    setTenureMonths(36);
    setCreditScore(790);
    setAuctionState('idle');
    setAuctionStepIndex(0);
    setBids([]);
    setSelectedBid(null);
    setShowESignModal(false);
    setEsignOtp('123456');
    setEsignRequestId(null);
    setEsignMethod(null);
    setDisbursedTxId(null);
    completionRequestId.current = crypto.randomUUID();
  };

  const handleTriggerESign = async (method: 'setu_hosted' | 'simulated_otp') => {
    const hostedWindow = method === 'setu_hosted' ? window.open('about:blank', '_blank') : null;
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/setu/esign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: method === 'simulated_otp' ? 'SIMULATE_INITIATE' : 'INITIATE', signerIdentifier: mobileNumber, displayName: kycResult?.data.full_name || 'Verified borrower' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to initiate Aadhaar eSign.');
      setEsignMethod(method);
      setEsignRequestId(data.id);
      const signingUrl = data.signingUrl || data.signers?.[0]?.url || data.url;
      if (method === 'setu_hosted' && signingUrl && hostedWindow) {
        hostedWindow.opener = null;
        hostedWindow.location.href = signingUrl;
      }
      else if (method === 'setu_hosted' && signingUrl) throw new Error('Your browser blocked the Setu signing window. Allow pop-ups and try again.');
      else if (method === 'simulated_otp') setShowESignModal(true);
      else throw new Error('Setu did not return a hosted signing URL.');
    } catch (error) {
      hostedWindow?.close();
      setErrorMessage(error instanceof Error ? error.message : 'Unable to initiate Aadhaar eSign.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeAgreement = async () => {
    setLoading(true);
    try {
      if (esignRequestId && esignMethod === 'simulated_otp') {
        const verifyResponse = await fetch('/api/setu/esign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'SIMULATE_VERIFY', id: esignRequestId, otp: esignOtp }) });
        const verification = await verifyResponse.json();
        if (!verifyResponse.ok || verification.status !== 'sign_complete') throw new Error(verification.error || 'Simulated Aadhaar OTP verification failed.');
      } else if (esignRequestId && esignMethod === 'setu_hosted') {
        const statusResponse = await fetch('/api/setu/esign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'STATUS', id: esignRequestId }) });
        const status = await statusResponse.json();
        if (!statusResponse.ok || status.status !== 'sign_complete') throw new Error('The Setu signature request is not complete yet.');
      }
      // Record the marketplace outcome; the lender owns disbursement and repayment records.
      const response = await fetch('/api/loan-applications/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completionRequestId: completionRequestId.current,
          lenderId: selectedBid?.lenderId,
          lenderName: selectedBid?.lenderName,
          amount: requiredAmount,
          tenureMonths: selectedBid?.offeredTenureMonths || tenureMonths,
          borrowerName: kycResult?.data.full_name || "Yogesha M J",
          interestRate: selectedBid?.calculatedAPR || 0,
          lenderCommissionPercent: selectedBid?.lenderCommissionPercent || 0,
          auctionBids: bids,
          riskScore: riskSummary.score,
          riskAction: riskSummary.action,
          riskReasons: riskSummary.reasons
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to complete transaction logging.');

      setDisbursedTxId(data.applicationId || `APPLICATION_${Date.now()}`);
      setShowESignModal(false);
      setCurrentStep(5); // Success Milestone
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col antialiased">
      {}
      <header className="bg-slate-950 border-b border-slate-800 py-4 px-8 flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-indigo-400">OptiRate</h1>
          <p className="text-[10px] text-slate-400">Compliant Lending Service Provider (LSP) Gateway</p>
        </div>
        <div className="flex items-center space-x-3 bg-slate-900/80 px-4 py-2 border border-slate-800 rounded-full">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          <span className="text-[11px] font-semibold text-slate-300">Sandbox active</span>
        </div>
      </header>

      {}
      <div className="bg-slate-950 py-4 border-b border-slate-850 px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {[
            { step: 1, label: 'PAN Verification' },
            { step: 2, label: 'Bank Consent' },
            { step: 3, label: 'Reverse Auction' },
            { step: 4, label: 'Agreement Review' },
            { step: 5, label: 'Disbursed' }
          ].map((item) => (
            <div key={item.step} className="flex items-center space-x-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${currentStep >= item.step ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {item.step}
              </div>
              <span className={`text-xs font-medium hidden md:inline transition-colors
                ${currentStep >= item.step ? 'text-indigo-300' : 'text-slate-500'}`}>
                {item.label}
              </span>
              {item.step < 5 && <div className="h-0.5 w-8 bg-slate-800 hidden md:block"></div>}
            </div>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 flex flex-col justify-center">
        {errorMessage && (
          <div className="mb-6 bg-rose-900/30 border border-rose-800/50 p-4 rounded-xl text-rose-300 text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 font-bold hover:text-white">&times;</button>
          </div>
        )}

        {/* ====================================================================
            STEP 1: PAN CARD IDENTITY GATE
            ==================================================================== */}
        {}
        {currentStep === 1 && (
          <div className="bg-slate-950 border border-slate-800 p-8 rounded-2xl shadow-xl max-w-lg mx-auto w-full">
            <h2 className="text-xl font-bold text-slate-100 mb-2">Step 1: Verify Identity</h2>
            <p className="text-xs text-slate-400 mb-6">Enter your permanent account number to verify your details in the secure identity registry.</p>
            
            <form onSubmit={handleVerifyPAN} className="space-y-5">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">PAN Card Number</label>
                <input 
                  type="text" 
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest uppercase text-center" 
                  maxLength={10}
                  required 
                />
              </div>

              <div className="flex items-start space-x-3 bg-slate-900/50 p-3.5 border border-slate-850 rounded-xl">
                <input 
                  type="checkbox" 
                  id="consent" 
                  checked={kycConsent} 
                  onChange={(e) => setKycConsent(e.target.checked)}
                  className="mt-1 accent-indigo-500"
                />
                <label htmlFor="consent" className="text-xs text-slate-400 leading-relaxed">
                  I hereby authorize OptiRate to verify my profile in the secure onboarding registry.
                </label>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white font-bold rounded-xl shadow-lg active:scale-95 disabled:bg-slate-800 flex items-center justify-center space-x-2"
              >
                {loading ? 'Consulting Registry...' : 'Verify Details \u2192'}
              </button>
            </form>
          </div>
        )}

        {/* ====================================================================
            STEP 2: SETU ACCOUNT AGGREGATOR STATEMENT LINK
            ==================================================================== */}
        {}
        {currentStep === 2 && (
          <div className="bg-slate-950 border border-slate-800 p-8 rounded-2xl shadow-xl max-w-lg mx-auto w-full text-center">
            <div className="w-16 h-16 bg-emerald-950/50 border border-emerald-800/30 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">
              ✅
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-1">Identity Confirmed!</h2>
            <p className="text-sm font-semibold text-emerald-400 mb-6">Welcome, {kycResult?.data.full_name || 'Yogesha M J'}</p>

            <div className="border border-slate-850 rounded-2xl bg-slate-900/30 p-6 text-left space-y-4 mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Step 2: Link Statement via Account Aggregator</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                OptiRate runs backend-only bank analytics to evaluate your transaction history and underwriting readiness.
              </p>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Registered Phone Number</label>
                <input 
                  type="text" 
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                  placeholder="Enter 10-digit number"
                />
              </div>
            </div>

            <button 
              onClick={handleInitiateAAConsent}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-colors"
            >
              Continue to bank consent &rarr;
            </button>
          </div>
        )}

        {/* ====================================================================
            STEP 3: REVERSE AUCTION BIDDING VIEW
            ==================================================================== */}
        {}
        {currentStep === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left side parameters */}
            <div className="lg:col-span-4 bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
              <h2 className="text-lg font-bold text-slate-100 border-b border-slate-850 pb-3">Auction Controls</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Loan Amount (INR)</label>
                  <input 
                    type="number"
                    inputMode="numeric"
                    placeholder="Enter amount"
                    value={requiredAmountInput}
                    onChange={(e) => setRequiredAmountInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-850 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-mono" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Tenure (Months)</label>
                  <select 
                    value={tenureMonths} 
                    onChange={(e) => setTenureMonths(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-850 text-white rounded-lg px-3 py-2 text-sm"
                  >
                    <option value={12}>12 Months</option>
                    <option value={24}>24 Months</option>
                    <option value={36}>36 Months</option>
                    <option value={48}>48 Months</option>
                    <option value={60}>60 Months</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Bureau profile</label>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 flex justify-between text-xs">
                    <span className="text-slate-400">{getMockAAProfile(selectedProfileId).bureauStatus.replace(/_/g, ' ')}</span>
                    <span className="text-indigo-400 font-bold">{creditScore === 0 ? 'No credit history' : creditScore}</span>
                  </div>
                </div>

                <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">AA affordability snapshot</div>
                  <div className="flex justify-between text-xs"><span className="text-slate-400">Net monthly income credited</span><span className="font-mono">₹{(linkedBank?.netMonthlyIncome || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-400">Fixed monthly obligations</span><span className="font-mono">₹{(linkedBank?.fixedMonthlyObligations || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-400">Current DTI</span><span className="font-mono">{((linkedBank?.fixedMonthlyObligations || 0) / Math.max(linkedBank?.netMonthlyIncome || 1, 1) * 100).toFixed(2)}%</span></div>
                  <div className="flex justify-between text-xs border-t border-indigo-800/40 pt-2"><span className="text-slate-300 font-bold">Expected DTI at requested tenure</span><span className="font-mono text-amber-300 font-bold">{expectedDtiPercent.toFixed(2)}%</span></div>
                  <p className="text-[9px] text-slate-500">Expected DTI uses an indicative 16% rate. Each lender recalculates it using its offered rate and tenure.</p>
                </div>

                <div className="bg-slate-900 border border-slate-850 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-400">
                    <span>Risk engine</span>
                    <span className="font-bold text-indigo-300">{riskSummary.action}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Score</span>
                    <span className="font-mono text-emerald-400">{riskSummary.score}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Discipline</span>
                    <span className="font-mono text-cyan-300">{riskSummary.reasons.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Eligibility</span>
                    <span className="font-mono text-amber-300">{riskSummary.action}</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={triggerReverseAuction}
                disabled={auctionState === 'broadcasting'}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white font-bold rounded-xl active:scale-95 disabled:bg-slate-850"
              >
                Broadcast to Bidders &rarr;
              </button>
            </div>

            {/* Right side live feedback dashboard */}
            {}
            <div className="lg:col-span-8 bg-slate-950 border border-slate-800 p-5 sm:p-7 rounded-2xl shadow-xl min-h-[400px] flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-100 mb-4 border-b border-slate-850 pb-3">Auction Engine Results</h2>
                
                {auctionState === 'idle' && (
                  <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                    <p className="font-medium text-slate-400 text-sm">Awaiting Onboarding Setup Criteria...</p>
                    <p className="text-xs text-slate-500 mt-1">Configure your loan variables on the left, then click broadcast.</p>
                  </div>
                )}

                {auctionState === 'broadcasting' && (
                  <div className="py-20 flex flex-col items-center justify-center space-y-6">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                    <div className="text-center space-y-2">
                      <p className="text-md font-bold text-indigo-400 animate-pulse">{BROADCAST_LOGS[auctionStepIndex]}</p>
                      <p className="text-xs text-slate-500">Evaluating multi-entity pricing metrics...</p>
                    </div>
                  </div>
                )}

                {auctionState === 'completed' && bids.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-emerald-900/50 bg-emerald-950/20 px-4 py-3">
                      <p className="text-xs text-emerald-100"><strong>Borrower-first pricing.</strong> Offers are ranked by true APR so the lowest total borrowing cost comes first.</p>
                      <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Lowest true APR first</span>
                    </div>
                    {bids.map((bid) => (
                      <article key={bid.id} className={`rounded-2xl border p-5 transition-colors ${bid.status === 'Approved' ? 'border-slate-700 bg-slate-900/60 hover:border-indigo-700' : 'border-slate-850 bg-slate-900/20 opacity-70'}`}>
                        <div className="flex flex-col gap-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 min-w-0">
                              <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold ${bid.status === 'Approved' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                {bid.status === 'Approved' ? `#${bid.rank}` : '—'}
                              </span>
                              <div>
                                <h3 className="font-bold text-slate-100 leading-tight">{bid.lenderName}</h3>
                                <p className="mt-1 text-[11px] leading-5 text-slate-400 max-w-xl">{bid.decisionReason}</p>
                              </div>
                            </div>
                            <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${bid.status === 'Approved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-850 text-slate-500 border border-slate-800'}`}>{bid.status}</span>
                          </div>

                          {bid.status === 'Approved' && (
                            <>
                              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                                <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3"><span className="block text-[9px] uppercase tracking-wider text-slate-500">True APR</span><strong className="block mt-1 font-mono text-lg text-emerald-400">{bid.calculatedAPR.toFixed(2)}%</strong></div>
                                <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3"><span className="block text-[9px] uppercase tracking-wider text-slate-500">Monthly EMI</span><strong className="block mt-1 font-mono text-lg text-slate-100">₹{bid.monthlyEMI.toLocaleString()}</strong></div>
                                <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3"><span className="block text-[9px] uppercase tracking-wider text-slate-500">Offered tenure</span><strong className="block mt-1 font-mono text-lg text-slate-100">{bid.offeredTenureMonths} mo</strong>{bid.offeredTenureMonths !== bid.requestedTenureMonths && <span className="text-[9px] text-amber-400">Adjusted for affordability</span>}</div>
                                <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3"><span className="block text-[9px] uppercase tracking-wider text-slate-500">Projected / max DTI</span><strong className="block mt-1 font-mono text-lg text-slate-100">{bid.projectedDtiPercent?.toFixed(2)}% <span className="text-slate-600">/</span> {bid.maxDtiPercent ?? '—'}%</strong></div>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                                <p className="text-[11px] text-slate-400">Interest <strong className="text-slate-200">{bid.baseInterestRate.toFixed(2)}%</strong>{bid.marketDiscountPercent ? <> · <strong className="text-emerald-400">{bid.marketDiscountPercent.toFixed(2)} points below market benchmark</strong></> : null}</p>
                                <button onClick={() => handleSelectBid(bid)} className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all active:scale-95">Review offer</button>
                              </div>
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {auctionState === 'completed' && bids.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <p className="font-medium text-amber-300 text-sm">No lender matched this application</p>
                    <p className="text-xs text-slate-500 mt-2 max-w-md">
                      This decision was recorded for audit. No lender bids or disbursement records were created.
                    </p>
                    <button
                      onClick={resetLoanApplication}
                      className="mt-6 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors"
                    >
                      Start new loan application
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            STEP 4: REGULATORY COMPLIANT KEY FACT STATEMENT (KFS)
            ==================================================================== */}
        {}
        {currentStep === 4 && selectedBid && (
          <div className="bg-white text-slate-900 border border-slate-300 p-8 rounded-2xl shadow-2xl max-w-2xl mx-auto w-full">
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight uppercase">Key Fact Statement (KFS)</h2>
                <p className="text-xs text-slate-500 font-medium mt-1">Legally mandated under RBI Digital Lending Guidelines</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold bg-slate-900 text-white px-2.5 py-1 rounded-full uppercase">Pre-Approved Offer</span>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-4">
                <div>
                  <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">Lending Institution</span>
                  <span className="font-bold text-slate-800 text-base">{selectedBid.lenderName}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">Regulated LSP Platform</span>
                  <span className="font-bold text-slate-800 text-base">OptiRate Marketplace</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-4">
                <div>
                  <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">Borrower Identity</span>
                  <span className="font-semibold text-slate-800">{kycResult?.data.full_name || 'Yogesha M J'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">Verified PAN ID</span>
                  <span className="font-semibold text-slate-800 font-mono">{pan}</span>
                </div>
              </div>

              {/* Financial calculations inside KFS */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3 font-mono">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-bold">1. Loan Principal Requested:</span>
                  <span className="font-bold text-slate-800">₹{requiredAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-bold">2. Upfront Processing Fee ({selectedBid.processingFeePercent}%):</span>
                  <span className="font-bold text-slate-800">₹{selectedBid.processingFeePercent > 0 ? (requiredAmount * (selectedBid.processingFeePercent / 100)).toLocaleString() : '0'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs text-slate-500 font-bold">3. Lender Interest Rate:</span>
                  <span className="font-bold text-emerald-600">{selectedBid.baseInterestRate}% p.a.</span>
                </div>
                <div className="flex justify-between border-b-2 border-slate-300 pb-2 bg-slate-100/50 -mx-3 px-3 rounded">
                  <span className="text-xs text-slate-600 font-bold">4. True APR including lender charges:</span>
                  <span className="font-extrabold text-indigo-700">{selectedBid.calculatedAPR}%</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-xs text-slate-500 font-bold">5. Monthly EMI Obligation:</span>
                  <span className="font-bold text-slate-800">₹{selectedBid.monthlyEMI.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-xs text-slate-500 font-bold">6. Offered tenure / projected DTI:</span>
                  <span className="font-bold text-slate-800">{selectedBid.offeredTenureMonths || tenureMonths} months / {selectedBid.projectedDtiPercent?.toFixed(2)}%</span>
                </div>
                {selectedBid.marketDiscountPercent !== undefined && selectedBid.marketDiscountPercent > 0 && (
                  <div className="flex justify-between pt-2 text-emerald-700">
                    <span className="text-xs font-bold">Below researched market benchmark:</span>
                    <span className="font-bold">{selectedBid.marketDiscountPercent}%</span>
                  </div>
                )}
              </div>

              {/* Legal protection context */}
              <div className="p-4 border border-indigo-200 bg-indigo-50/50 rounded-xl space-y-2 text-xs text-slate-600 leading-relaxed">
                <p><strong>Note on Cooling-off Period:</strong> A cooling-off period of 3 business days is allowed. During this period, the borrower may withdraw from this loan agreement without any pre-payment penalties.</p>
                <p><strong>Redressal Officer:</strong> For grievance escalations, contact the Nodal Grievance Redressal Officer at <strong>compliance@optirate.in</strong>.</p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 flex justify-end space-x-3">
              <button 
                onClick={() => setCurrentStep(3)}
                className="px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-sm transition-colors"
              >
                Back to Bids
              </button>
              <button onClick={() => void handleTriggerESign('simulated_otp')} disabled={loading} className="px-5 py-3 border border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
                Simulated Aadhaar OTP
              </button>
              {esignMethod === 'setu_hosted' && esignRequestId ? (
                <button onClick={() => void handleFinalizeAgreement()} disabled={loading} className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-sm transition-colors shadow-lg disabled:opacity-50">
                  Check Setu Signature & Continue
                </button>
              ) : hostedESignAvailable ? (
                <button onClick={() => void handleTriggerESign('setu_hosted')} disabled={loading} className="px-6 py-3 bg-slate-900 hover:bg-slate-850 text-white font-bold rounded-xl text-sm transition-colors shadow-lg disabled:opacity-50">
                  Setu Hosted eSign ({hostedESignEnvironment}) &rarr;
                </button>
              ) : (
                <span className="max-w-[220px] text-right text-[10px] leading-4 text-slate-500">Hosted Setu eSign becomes available after all five Vercel eSign variables are configured.</span>
              )}
            </div>
          </div>
        )}

        {/* ====================================================================
            STEP 5: DISBURSEMENT MILESTONE SUCCESS
            ==================================================================== */}
        {}
        {currentStep === 5 && selectedBid && (
          <div className="bg-slate-950 border border-slate-800 p-12 rounded-2xl shadow-xl text-center max-w-lg mx-auto w-full">
            <div className="w-20 h-20 bg-emerald-950/40 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-800/30">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-100 mb-2">Loan Approved!</h2>
            <p className="text-sm text-slate-400 mb-6">
              Your digital contract with <strong>{selectedBid.lenderName}</strong> has been signed via {esignMethod === 'simulated_otp' ? 'the simulated Aadhaar OTP demo' : 'Setu hosted Aadhaar eSign'} and mapped into the central core banking registry.
            </p>

            <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 text-left space-y-2 mb-6 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Disbursed Principal:</span>
                <span className="text-white">₹{requiredAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction Hash:</span>
                <span className="text-indigo-400 break-all">{disbursedTxId}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2">
                <span className="text-slate-500">Recipient Name:</span>
                <span className="text-white font-sans">{kycResult?.data.full_name || 'Yogesha M J'}</span>
              </div>
            </div>

            <button 
              onClick={resetLoanApplication}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors"
            >
              Configure new Loan application
            </button>
          </div>
        )}
      </main>

      {/* ====================================================================
          MOCK WEbVIEW DRAWER / MODAL SIMULATIONS (High Fidelity Sandbox Mode)
          ==================================================================== */}
      {/* Setu AA Consent Webview Modal */}
      {}
      {showAAWebview && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-filter backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[calc(100dvh-2rem)] overflow-hidden border border-slate-200 flex flex-col">
            {/* Header */}
            <div className="bg-indigo-650 text-white p-4 flex items-center justify-between">
              <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-100">Secure Bank Consent</span>
              <button onClick={() => setShowAAWebview(false)} className="text-white font-bold">&times;</button>
            </div>

            {/* OTP Phase */}
            {webviewStep === 'otp' && (
              <div className="p-6 space-y-4">
                <h3 className="text-md font-bold text-slate-800">Authenticate Consent Request</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter the mock secure SMS verification code sent to your registered mobile number <strong>+91 {mobileNumber}</strong>.
                </p>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Enter OTP</label>
                  <input 
                    type="text" 
                    value={webviewOtp}
                    onChange={(e) => setWebviewOtp(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-3 text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                  <span className="text-[10px] text-indigo-600 mt-1 block">Tip: Enter the test OTP <strong>&apos;123456&apos;</strong></span>
                </div>
                <button 
                  onClick={handleVerifyWebviewOtp}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors"
                >
                  Confirm and link accounts
                </button>
              </div>
            )}

            {/* Account Selection Phase */}
            {webviewStep === 'accounts' && (
              <div className="min-h-0 flex flex-1 flex-col">
                <div className="px-6 pt-5 pb-3 border-b border-slate-200">
                  <h3 className="text-md font-bold text-slate-800 font-sans">Available Bank Profiles</h3>
                  <p className="text-xs text-slate-500 mt-1">Choose a simulated financial account, then continue with the fixed button below.</p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-3 space-y-2" role="radiogroup" aria-label="Simulated borrower persona">
                  {MOCK_AA_PROFILES.map((profile) => (
                    <button
                      type="button"
                      key={profile.id}
                      onClick={() => { setSelectedProfileId(profile.id); setSelectedFip(profile.account.fip); setCreditScore(profile.creditScore); }}
                      role="radio"
                      aria-checked={selectedProfileId === profile.id}
                      className={`w-full p-3.5 border rounded-xl cursor-pointer flex justify-between items-center transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500
                        ${selectedProfileId === profile.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                    >
                      <span className="text-left pr-3">
                        <span className="font-bold text-xs text-slate-800 block">{profile.label}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">{profile.cashflowBehaviour} CASHFLOW · {profile.creditScore || 'NO'} BUREAU SCORE · {profile.account.maskedAccountNumber}</span>
                        <span className="text-[10px] text-slate-500 block mt-1">{profile.description}</span>
                      </span>
                      <span aria-hidden="true" className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center
                        ${selectedProfileId === profile.id ? 'border-indigo-600' : 'border-slate-300'}`}>
                        {selectedProfileId === profile.id && <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)]">
                  <p className="text-[10px] text-slate-500 leading-relaxed mb-3">
                    Selected: <strong className="text-slate-700">{getMockAAProfile(selectedProfileId).label}</strong>. Continuing grants permission to analyze its six-month simulated statement.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleCompleteConsentWebview()}
                    disabled={loading}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-colors"
                  >
                    {loading ? 'Linking selected profile…' : 'Continue with selected profile →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Aadhaar eSign Secure Modal */}
      {}
      {showESignModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-filter backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <span className="text-xs uppercase font-extrabold tracking-widest text-slate-300">Secure Digital Signature</span>
              <button onClick={() => setShowESignModal(false)} className="text-white font-bold">&times;</button>
            </div>

            <div className="p-6 space-y-4">
              <h3 className="text-md font-bold text-slate-800">Complete Digital Contract Signing</h3>
              <p className="text-xs text-slate-500">Simulation only: an OTP was sent to the Aadhaar-linked mobile ending in <strong>{mobileNumber.slice(-4)}</strong>. No Aadhaar number is collected or stored.</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Mock confirmation code</label>
                  <input 
                    type="text" 
                    value={esignOtp}
                    onChange={(e) => setEsignOtp(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-center font-mono tracking-widest text-base focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Demo OTP: <strong>123456</strong>. This does not contact UIDAI or Setu.</span>
                </div>
              </div>

              <button 
                onClick={handleFinalizeAgreement}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors shadow-lg mt-2"
              >
                Sign Contract and Disburse Funds &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
