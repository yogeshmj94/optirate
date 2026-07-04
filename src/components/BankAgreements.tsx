import React from 'react';
import { LoanBid } from '../types/lending';

// Pass the selected bid data into the templates so they can display the actual numbers
interface AgreementProps {
  bidData: Partial<LoanBid>;
}

export const TraditionalBankAgreement: React.FC<AgreementProps> = ({ bidData }) => (
  <div className="p-8 border-4 border-double border-gray-800 bg-stone-50 font-serif text-gray-900">
    <h2 className="text-2xl font-bold text-center mb-6 uppercase tracking-widest">Master Promissory Note</h2>
    <p className="mb-4 text-sm leading-relaxed text-justify">
      THIS LOAN AGREEMENT (the "Agreement") is made and entered into, by and between the Borrower and 
      <strong> {bidData.lenderName || 'The Institution'}</strong>. 
      The Borrower hereby promises to pay the principal sum, together with interest at the agreed Annual Percentage Rate 
      of <strong>{bidData.calculatedAPR}%</strong>.
    </p>
    <div className="my-6 p-4 border border-gray-400">
      <h3 className="font-bold underline mb-2">Schedule of Payments</h3>
      <ul className="list-disc pl-5 text-sm">
        <li>Monthly EMI: ₹{bidData.monthlyEMI?.toLocaleString()}</li>
        <li>Processing Fee: {bidData.processingFeePercent}%</li>
        <li>Total Estimated Payout: ₹{bidData.totalPayout?.toLocaleString()}</li>
      </ul>
    </div>
    <div className="mt-12 border-t border-gray-800 pt-4 flex justify-between">
      <span>Borrower Signature: ___________________</span>
      <span>Date: {new Date().toLocaleDateString()}</span>
    </div>
  </div>
);

export const FintechStartupAgreement: React.FC<AgreementProps> = ({ bidData }) => (
  <div className="p-8 bg-gradient-to-br from-indigo-900 to-purple-900 text-white rounded-xl font-sans shadow-2xl">
    <h2 className="text-3xl font-extrabold mb-2">Your {bidData.lenderName} Loan Details</h2>
    <p className="text-indigo-200 mb-8">Fast, transparent, and built for you. Please review your final numbers below.</p>
    
    <div className="grid grid-cols-2 gap-4 mb-8">
      <div className="bg-white/10 p-4 rounded-lg">
        <p className="text-xs text-indigo-300 uppercase tracking-wider">Monthly Payment</p>
        <p className="text-2xl font-bold">₹{bidData.monthlyEMI?.toLocaleString()}</p>
      </div>
      <div className="bg-white/10 p-4 rounded-lg">
        <p className="text-xs text-indigo-300 uppercase tracking-wider">Effective APR</p>
        <p className="text-2xl font-bold">{bidData.calculatedAPR}%</p>
      </div>
    </div>
    <p className="text-sm text-indigo-200 text-center">
      By clicking "Digitally Sign" below, you agree to our electronic terms of service.
    </p>
  </div>
);

export const DefaultSimpleAgreement: React.FC<AgreementProps> = ({ bidData }) => (
  <div className="p-6 bg-white border border-gray-200 rounded text-gray-800 shadow-sm">
    <h2 className="text-xl font-semibold border-b pb-2 mb-4">Standard Loan Term Sheet</h2>
    <p className="mb-4">You are accepting a loan from <strong>{bidData.lenderName}</strong>.</p>
    <ul className="space-y-2 mb-6 bg-gray-50 p-4 rounded">
      <li><strong>Interest Rate:</strong> {bidData.baseInterestRate}%</li>
      <li><strong>Monthly EMI:</strong> ₹{bidData.monthlyEMI?.toLocaleString()}</li>
      <li><strong>Total Payout:</strong> ₹{bidData.totalPayout?.toLocaleString()}</li>
    </ul>
    <p className="text-xs text-gray-500 italic">This is a standard fallback agreement template.</p>
  </div>
);