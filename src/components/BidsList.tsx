'use client';

import { AuctionResponse } from '@/types/lending';
import { BidCard } from './BidCard';

interface BidsListProps {
  auctionData: AuctionResponse;
  onAcceptBid: (bidId: string) => void;
  acceptingBidId?: string;
}

export const BidsList = ({ auctionData, onAcceptBid, acceptingBidId }: BidsListProps) => {
  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-gradient-to-r from-primary-900/20 to-slate-900/20 border border-primary-500/20 rounded-xl p-6">
        <div className="grid grid-cols-3 gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Loan Amount</div>
            <div className="text-2xl font-bold text-slate-100 mt-2">
              ₹{(auctionData.requestedAmount / 100000).toFixed(1)}L
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Tenure</div>
            <div className="text-2xl font-bold text-slate-100 mt-2">
              {auctionData.tenure} months
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Total Bids</div>
            <div className="text-2xl font-bold text-slate-100 mt-2">
              {auctionData.bids.length}
            </div>
          </div>
        </div>
      </div>

      {/* Bids Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-100">Competing Bids (Sorted by Best APR)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:grid-cols-3">
          {auctionData.bids.map((bid) => (
            <BidCard
              key={bid.id}
              bid={bid}
              onAccept={() => onAcceptBid(bid.id)}
              isAccepting={acceptingBidId === bid.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
