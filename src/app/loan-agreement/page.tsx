'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { 
  TraditionalBankAgreement, 
  FintechStartupAgreement, 
  DefaultSimpleAgreement 
} from '@/components/BankAgreements';

function AgreementContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [isSigning, setIsSigning] = useState(false);
  const [signatureSuccess, setSignatureSuccess] = useState(false);
  const completionRequestId = useRef<string>(crypto.randomUUID());

  // Extract the data passed from the URL
  const lenderId = searchParams.get('lenderId') || 'unknown';
  const lenderName = searchParams.get('lenderName') || 'Unknown Lender';
  const monthlyEMI = Number(searchParams.get('emi'));
  const calculatedAPR = Number(searchParams.get('apr'));
  const totalPayout = Number(searchParams.get('payout'));
  const baseInterestRate = Number(searchParams.get('rate'));
  const requestedTenureMonths = Number(searchParams.get('tenureMonths'));
  const tenureMonths = Number.isInteger(requestedTenureMonths) && requestedTenureMonths > 0
    ? requestedTenureMonths
    : 12;

  const principalParam = Number(searchParams.get('principal'));
  const principal = isNaN(principalParam) || principalParam === 0 ? totalPayout : principalParam;
  
  const borrowerParam = searchParams.get('borrowerName');
  const borrowerName = borrowerParam || 'Test Borrower';

  const bidData = { lenderName, monthlyEMI, calculatedAPR, totalPayout, baseInterestRate };

  const handleDigitalSign = async () => {
    setIsSigning(true);
    
    try {
      // Record the marketplace outcome; the lender owns disbursement and repayment records.
      const response = await fetch('/api/loan-applications/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completionRequestId: completionRequestId.current,
          lenderId,
          lenderName,
          amount: principal, 
          tenureMonths,
          borrowerName,
          interestRate: baseInterestRate
        })
      });

      if (!response.ok) throw new Error('Disbursement failed');

      setSignatureSuccess(true);
      
      // Redirect back to home after 4 seconds to view the fresh state
      setTimeout(() => {
        router.push('/');
      }, 4000);

    } catch (error) {
      console.error("Failed to sign:", error);
      alert("There was an error recording the marketplace application.");
      setIsSigning(false);
    }
  };

  const renderTemplate = () => {
    if (lenderId === 'lender_01' || lenderId === 'lender_02') {
      return <TraditionalBankAgreement bidData={bidData} />;
    } 
    if (lenderId === 'lender_03' || lenderId === 'lender_05') {
      return <FintechStartupAgreement bidData={bidData} />;
    }
    return <DefaultSimpleAgreement bidData={bidData} />;
  };

  if (signatureSuccess) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-12 rounded-2xl shadow-xl text-center max-w-lg w-full transform transition-all scale-100 animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Application Recorded</h2>
          <p className="text-gray-600 mb-6">
            Your agreement with <strong>{lenderName}</strong> has been recorded by the marketplace. The lender remains responsible for disbursement and repayment records.
          </p>
          <div className="text-sm text-gray-400 animate-pulse">Redirecting to dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <button 
          onClick={() => router.push('/')}
          className="mb-6 text-sm text-blue-600 hover:text-blue-800 flex items-center transition-colors font-medium"
          disabled={isSigning}
        >
          &larr; Back to Dashboard
        </button>

        <div className={isSigning ? "opacity-50 pointer-events-none transition-opacity" : ""}>
          {renderTemplate()}
        </div>

        <div className="mt-8 flex justify-end relative">
          <button 
            onClick={handleDigitalSign}
            disabled={isSigning}
            className={`font-bold py-4 px-8 rounded-lg shadow-lg transition-all active:scale-95 flex items-center justify-center min-w-[250px]
              ${isSigning ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
          >
            {isSigning ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Recording marketplace outcome...
              </>
            ) : (
              'Digitally Sign & Finalize'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoanAgreementPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500 font-medium">Loading Agreement Module...</div>}>
      <AgreementContent />
    </Suspense>
  );
}