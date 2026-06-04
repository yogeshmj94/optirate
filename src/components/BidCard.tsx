'use client';

import { LoanBid } from '@/types/lending';

interface BidCardProps {
  bid: LoanBid;
  onAccept: (bid: LoanBid) => void;
  isAccepting?: boolean;
}

export const BidCard = ({ bid, onAccept, isAccepting = false }: BidCardProps) => {
  const isLowestAPR = bid.rank === 1;

  return (
    <div
      className={`rounded-xl border transition-all ${
        isLowestAPR
          ? 'border-primary-500 bg-slate-800/80 ring-2 ring-primary-500/20'
          : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
      }`}
    >
      <div className="p-6 space-y-4">
        {/* Header: Rank and Lender Info */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{bid.lenderLogo || '🏦'}</div>
            <div>
              <div className="font-semibold text-slate-100">{bid.lenderName}</div>
              {isLowestAPR && (
                <div className="text-xs font-medium text-primary-400 mt-1">🏆 Best Rate</div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary-400">Rank #{bid.rank}</div>
          </div>
        </div>

        {/* APR Highlight */}
        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
          <div className="text-sm text-slate-400 mb-1">Annual Percentage Rate (APR)</div>
          <div className="text-4xl font-bold text-primary-300">{bid.calculatedAPR.toFixed(2)}%</div>
        </div>

        {/* Rate Breakdown */}
        <div className="grid grid-cols-2 gap-4 py-3">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Base Rate</div>
            <div className="text-lg font-semibold text-slate-100 mt-1">
              {bid.baseInterestRate.toFixed(2)}% p.a.
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Processing Fee</div>
            <div className="text-lg font-semibold text-slate-100 mt-1">
              {bid.processingFeePercent.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* EMI Details */}
        <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/50">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Monthly EMI</div>
              <div className="text-2xl font-bold text-slate-100">₹{bid.monthlyEMI.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Payout</div>
              <div className="text-lg font-semibold text-slate-400">₹{bid.totalPayout.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
          </div>
        </div>

        {/* Accept Button */}
        <button
          onClick={() => onAccept(bid)}
          disabled={isAccepting}
          className={`w-full py-3 rounded-lg font-semibold transition-all ${
            isLowestAPR
              ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isAccepting ? 'Processing...' : 'Accept Bid & Lock Rate'}
        </button>
      </div>
    </div>
  );
};
