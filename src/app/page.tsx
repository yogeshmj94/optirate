'use client';

import { useMemo, useState } from 'react';
import { buildMockCashflowHistory, buildPanProfileTransactions, evaluateBorrower } from '@/services/riskEngine';

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
  const [linkedBank, setLinkedBank] = useState<BankAccount | null>(null);
  const [consentId, setConsentId] = useState<string | null>(null);

  // Step 3 States (Reverse Auction Broadcast)
  const [requiredAmountInput, setRequiredAmountInput] = useState<string>('');
  const [tenureMonths, setTenureMonths] = useState<number>(36);
  const [creditScore, setCreditScore] = useState<number>(740);
  const [auctionState, setAuctionState] = useState<'idle' | 'broadcasting' | 'completed'>('idle');
  const [auctionStepIndex, setAuctionStepIndex] = useState<number>(0);
  const [bids, setBids] = useState<Bid[]>([]);
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);

  // Step 4 States (KFS & eSign)
  const [showESignModal, setShowESignModal] = useState<boolean>(false);
  const [esignAadhaar, setEsignAadhaar] = useState<string>('1234 5678 9012');
  const [esignOtp, setEsignOtp] = useState<string>('123456');
  const [disbursedTxId, setDisbursedTxId] = useState<string | null>(null);

  const requiredAmount = Number(requiredAmountInput || 0);

  const riskSummary = useMemo(() => {
    const profilePans = ['ABCDE1234A', 'ABCDE1234B', 'ABCDE1234C'];
    const transactions = profilePans.includes(pan)
      ? buildPanProfileTransactions(pan)
      : buildMockCashflowHistory(mobileNumber === '9999999999' ? 'TATA_EMPLOYER_CORP_HASH' : 'BUSINESS_INFLOW_HASH');
    return evaluateBorrower(transactions);
  }, [mobileNumber, pan]);

  // Reverse Auction step description logs
  const BROADCAST_LOGS = [
    'Establishing secure LSP connection to regulatory routing gateway...',
    `Layered underwriting: SRI ${riskSummary.score}, action ${riskSummary.action}.`,
    `Broadcasting simulated Setu sandbox risk profile to 10 partner banks...`,
    'Aggregating live, competitive rate bids from lending queues...'
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
        body: JSON.stringify({ action: 'INITIATE', mobileNumber })
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

    try {
      const response = await fetch('/api/setu/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CHECK_STATUS', consentId })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Consent status check failed');

      setSelectedFip(data.linkedAccounts?.[0]?.FIP || selectedFip);
      setWebviewStep('accounts');
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleCompleteConsentWebview = async () => {
    try {
      const sessionResponse = await fetch('/api/setu/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_SESSION', consentId })
      });
      const sessionData = await sessionResponse.json();
      if (!sessionResponse.ok) throw new Error(sessionData.error || 'Data session creation failed');

      const dataResponse = await fetch('/api/setu/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'FETCH_DATA', sessionId: sessionData.sessionId })
      });
      const data = await dataResponse.json();
      if (!dataResponse.ok) throw new Error(data.error || 'Failed to fetch statement data');

      const transactions = data.data?.account?.transactions || [];
      const income = transactions
        .filter((tx: any) => tx.type === 'CREDIT')
        .reduce((sum: number, tx: any) => sum + tx.amount, 0) / Math.max(transactions.filter((tx: any) => tx.type === 'CREDIT').length, 1);
      const expense = transactions
        .filter((tx: any) => tx.type === 'DEBIT')
        .reduce((sum: number, tx: any) => sum + tx.amount, 0) / Math.max(transactions.filter((tx: any) => tx.type === 'DEBIT').length, 1);

      const mockStatement: BankAccount = {
        FIP: selectedFip,
        accountType: 'SAVINGS',
        balance: data.data?.account?.summary?.balance || 145000,
        monthlyIncome: Math.round(income),
        monthlyExpense: Math.round(expense)
      };

      setLinkedBank(mockStatement);
      setShowAAWebview(false);
      setCurrentStep(3);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const triggerReverseAuction = () => {
    setAuctionState('broadcasting');
    setAuctionStepIndex(0);

    // Simulate stepping through broadcasting stages
    const interval = setInterval(() => {
      setAuctionStepIndex((prev) => {
        if (prev >= BROADCAST_LOGS.length - 1) {
          clearInterval(interval);
          generateCompetitiveBids();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const generateCompetitiveBids = () => {
    const income = linkedBank?.monthlyIncome || 120000;
    const expense = linkedBank?.monthlyExpense || 40000;

    if (riskSummary.action === 'BLOCK_AUCTION') {
      setBids([]);
      setAuctionState('completed');
      setErrorMessage('Borrower is flagged as high-risk: low discipline or unstable inflow detected in the simulated Setu analytics.');
      return;
    }

    const riskPremium = (riskSummary.score * 0.04) + Math.max(0, (700 - creditScore) * 0.003);
    const priceBid = (
      id: string,
      lenderId: string,
      lenderName: string,
      baseInterestRate: number,
      processingFeePercent: number,
      rank: number,
    ): Bid => {
      const offeredRate = baseInterestRate + riskPremium;
      const monthlyEMI = Math.round(calculateEmi(requiredAmount, offeredRate, tenureMonths));
      const totalPayout = Math.round(
        (monthlyEMI * tenureMonths) + (requiredAmount * (processingFeePercent / 100)),
      );

      return {
        id,
        lenderId,
        lenderName,
        baseInterestRate: offeredRate,
        processingFeePercent,
        calculatedAPR: Number((offeredRate + (processingFeePercent / (tenureMonths / 12))).toFixed(2)),
        monthlyEMI,
        totalPayout,
        rank,
        status: 'Approved',
      };
    };

    // Simulate 3 diverse bank underwriting engines
    const simulatedBids: Bid[] = [
      {
        ...priceBid('bid_idfc', 'lender_01', 'IDFC First Bank', 10.25, 0.5, 2),
      },
      {
        ...priceBid('bid_navi', 'lender_02', 'Navi Finserv', 9.90, 0, 1),
      },
      {
        ...priceBid('bid_kotak', 'lender_03', 'Kotak Mahindra Bank', 10.75, 0.8, 3),
      }
    ];

    // Filter based on simulated dynamic Debt-To-Income thresholds
    const filteredBids = simulatedBids.map(bid => {
      const dtiRatio = (expense + bid.monthlyEMI) / income;
      const riskGatePassed = riskSummary.action !== 'BLOCK_AUCTION';
      if (dtiRatio > 0.55 || creditScore < 560 || !riskGatePassed) {
        return { ...bid, status: 'Rejected', rank: 999 };
      }
      return bid;
    });

    // Re-sort and rank active approvals
    const approved = filteredBids.filter(b => b.status === 'Approved').sort((a, b) => a.calculatedAPR - b.calculatedAPR);
    approved.forEach((b, idx) => b.rank = idx + 1);

    setBids([...approved, ...filteredBids.filter(b => b.status === 'Rejected')]);
    setAuctionState('completed');
  };

  const calculateEmi = (p: number, r: number, n: number) => {
    const monthlyRate = r / 12 / 100;
    return (p * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
  };

  const handleSelectBid = (bid: Bid) => {
    setSelectedBid(bid);
    setCurrentStep(4); // Advance to KFS screen
  };

  const handleTriggerESign = () => {
    setShowESignModal(true);
    setWebviewStep('otp'); // reuse webview screen state helper for modal views
  };

  const handleFinalizeAgreement = async () => {
    setLoading(true);
    try {
      // Record the marketplace outcome; the lender owns disbursement and repayment records.
      const response = await fetch('/api/loan-applications/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lenderId: selectedBid?.lenderId,
          lenderName: selectedBid?.lenderName,
          amount: requiredAmount,
          tenureMonths,
          borrowerName: kycResult?.data.full_name || "Yogesha M J",
          interestRate: selectedBid?.calculatedAPR || 0
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
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Credit Score</label>
                  <input 
                    type="range" 
                    min="300" 
                    max="900" 
                    value={creditScore}
                    onChange={(e) => setCreditScore(Number(e.target.value))}
                    className="w-full accent-indigo-500" 
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>300 (Poor)</span>
                    <span className="text-indigo-400 font-bold">{creditScore}</span>
                    <span>900 (Excellent)</span>
                  </div>
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
            <div className="lg:col-span-8 bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl min-h-[400px] flex flex-col justify-between">
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
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-850 text-[10px] text-slate-500 uppercase tracking-widest">
                            <th className="py-3 px-2">Rank</th>
                            <th className="py-3 px-2">Lender</th>
                            <th className="py-3 px-2">True APR</th>
                            <th className="py-3 px-2">Monthly EMI</th>
                            <th className="py-3 px-2">Status</th>
                            <th className="py-3 px-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 text-sm">
                          {bids.map((bid) => (
                            <tr key={bid.id} className="hover:bg-slate-900/40 transition-colors">
                              <td className="py-4 px-2 font-bold text-indigo-400">
                                {bid.status === 'Approved' ? `#${bid.rank}` : '—'}
                              </td>
                              <td className="py-4 px-2 font-medium">{bid.lenderName}</td>
                              <td className="py-4 px-2 font-mono text-emerald-400">
                                {bid.status === 'Approved' ? `${bid.calculatedAPR.toFixed(2)}%` : '—'}
                              </td>
                              <td className="py-4 px-2 font-mono">
                                {bid.status === 'Approved' ? `₹${bid.monthlyEMI.toLocaleString()}` : '—'}
                              </td>
                              <td className="py-4 px-2">
                                <span className={`text-xs font-semibold ${bid.status === 'Approved' ? 'text-emerald-400' : 'text-slate-600'}`}>
                                  {bid.status}
                                </span>
                              </td>
                              <td className="py-4 px-2 text-right">
                                {bid.status === 'Approved' ? (
                                  <button 
                                    onClick={() => handleSelectBid(bid)}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 font-bold rounded-lg text-xs transition-all active:scale-95"
                                  >
                                    Accept Offer
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-500">DTI Limit Breached</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
                  <span className="text-xs text-slate-500 font-bold">3. Total Interest Rate:</span>
                  <span className="font-bold text-emerald-600">{selectedBid.baseInterestRate}% p.a.</span>
                </div>
                <div className="flex justify-between border-b-2 border-slate-300 pb-2 bg-slate-100/50 -mx-3 px-3 rounded">
                  <span className="text-xs text-slate-600 font-bold">4. True Annual Percentage Rate (APR):</span>
                  <span className="font-extrabold text-indigo-700">{selectedBid.calculatedAPR}%</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-xs text-slate-500 font-bold">5. Monthly EMI Obligation:</span>
                  <span className="font-bold text-slate-800">₹{selectedBid.monthlyEMI.toLocaleString()}</span>
                </div>
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
              <button 
                onClick={handleTriggerESign}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-850 text-white font-bold rounded-xl text-sm transition-colors shadow-lg"
              >
                Accept and eSign Contract &rarr;
              </button>
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
              Your digital contract with <strong>{selectedBid.lenderName}</strong> has been signed via Aadhaar eSign and mapped into the central core banking registry.
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
              onClick={() => {
                setCurrentStep(1);
                setKycConsent(false);
                setSelectedBid(null);
              }}
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
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
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
              <div className="p-6 space-y-4">
                <h3 className="text-md font-bold text-slate-800 font-sans">Available Bank Profiles</h3>
                <p className="text-xs text-slate-500">Choose the simulated financial account to link with this loan verification request.</p>
                
                <div className="space-y-2">
                  {['Setu Mock Bank', 'HDFC Core Mock Bank', 'ICICI Core Mock Bank'].map((bankName) => (
                    <div 
                      key={bankName}
                      onClick={() => setSelectedFip(bankName)}
                      className={`p-3.5 border rounded-xl cursor-pointer flex justify-between items-center transition-all
                        ${selectedFip === bankName ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                    >
                      <div className="text-left">
                        <span className="font-bold text-xs text-slate-800 block">{bankName}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">SAVINGS •••• 9876</span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                        ${selectedFip === bankName ? 'border-indigo-600' : 'border-slate-300'}`}>
                        {selectedFip === bankName && <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] text-slate-400 leading-relaxed border-t pt-3">
                  By clicking approve, you grant permission to securely analyze the latest transaction history for underwriting checks.
                </div>

                <button 
                  onClick={handleCompleteConsentWebview}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors"
                >
                  Approve and Link Consent &rarr;
                </button>
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
              <p className="text-xs text-slate-500">Your pre-approved Key Fact Statement (KFS) contract requires an authenticated signature.</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Aadhaar ID Number</label>
                  <input 
                    type="text" 
                    value={esignAadhaar}
                    onChange={(e) => setEsignAadhaar(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-center font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Enter OTP</label>
                  <input 
                    type="text" 
                    value={esignOtp}
                    onChange={(e) => setEsignOtp(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-center font-mono tracking-widest text-base focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">A secure signature code has been simulated for your session.</span>
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