'use client';

import { useState } from 'react';
import { BorrowerForm } from '@/components/BorrowerForm';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { BidsList } from '@/components/BidsList';
import { TransparencyFooter } from '@/components/TransparencyFooter';
import { useAuctionState } from '@/hooks/useAuctionState';

export default function Home() {
  const auction = useAuctionState();
  const [acceptingBidId, setAcceptingBidId] = useState<string>();

  const handleAcceptBid = async (bidId: string) => {
    setAcceptingBidId(bidId);
    // Simulate bid acceptance delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    alert(`Bid ${bidId} accepted! Redirecting to loan agreement...`);
    setAcceptingBidId(undefined);
    auction.reset();
  };

  return (
    <main className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">optirate 🎯</h1>
              <p className="text-sm text-slate-400 mt-1">Competitive Loan Auction Platform</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400">Smart Rate Discovery</div>
              <div className="text-xs text-slate-500 mt-1">Powered by FinBox Multi-Lender Engine</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {auction.state === 'idle' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Left: Form */}
            <div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Find Your Best Loan Rate</h2>
                <p className="text-slate-400">
                  Enter your details below. We&apos;ll instantly auction your loan across 12+ partner lenders
                  and show you the best rates in real-time.
                </p>
              </div>
              <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-8">
                <BorrowerForm
                  onSubmit={auction.submitAuction}
                  isLoading={auction.state === 'loading'}
                />
              </div>
            </div>

            {/* Right: Info Panels */}
            <div className="space-y-6">
              {/* How It Works */}
              <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">⚡</span> How It Works
                </h3>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="text-primary-400 font-bold flex-shrink-0">1</span>
                    <span className="text-slate-300">Fill your profile details</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-primary-400 font-bold flex-shrink-0">2</span>
                    <span className="text-slate-300">We anonymize & broadcast to lenders</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-primary-400 font-bold flex-shrink-0">3</span>
                    <span className="text-slate-300">Lenders compete on rates instantly</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-primary-400 font-bold flex-shrink-0">4</span>
                    <span className="text-slate-300">Compare & accept your best offer</span>
                  </li>
                </ol>
              </div>

              {/* Key Benefits */}
              <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">✨</span> Why optirate
                </h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex gap-3 items-start">
                    <span className="text-primary-400 text-lg flex-shrink-0">🔒</span>
                    <span className="text-slate-300">Your data is anonymized & secure</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-primary-400 text-lg flex-shrink-0">⚖️</span>
                    <span className="text-slate-300">Transparent APR calculations</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-primary-400 text-lg flex-shrink-0">🏆</span>
                    <span className="text-slate-300">Guaranteed best market rate</span>
                  </li>
                  <li className="flex gap-3 items-start">
                    <span className="text-primary-400 text-lg flex-shrink-0">⚡</span>
                    <span className="text-slate-300">Results in seconds, not days</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {auction.state === 'loading' && (
          <div className="max-w-2xl mx-auto">
            <LoadingAnimation steps={auction.loadingSteps} currentStep={auction.currentStep} />
          </div>
        )}

        {auction.state === 'success' && auction.auctionResult && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">🎉 Auction Results for {auction.auctionResult.borrowerName}</h2>
              <p className="text-slate-400">
                {auction.auctionResult.bids.length} lenders competed. Choose your best rate below.
              </p>
            </div>
            <BidsList
              auctionData={auction.auctionResult}
              onAcceptBid={handleAcceptBid}
              acceptingBidId={acceptingBidId}
            />
            <TransparencyFooter />
            <div className="mt-8 text-center">
              <button
                onClick={auction.reset}
                className="px-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
              >
                ← Start New Auction
              </button>
            </div>
          </div>
        )}

        {auction.state === 'error' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-red-900/20 border border-red-800 rounded-xl p-8 text-center">
              <div className="text-4xl mb-4">❌</div>
              <h3 className="text-xl font-bold text-red-200 mb-2">Auction Failed</h3>
              <p className="text-red-300 mb-6">{auction.error}</p>
              <button
                onClick={auction.reset}
                className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/30 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
            <div>
              <div className="font-semibold text-slate-200 mb-3">Product</div>
              <ul className="space-y-2 text-slate-400 text-xs">
                <li><a href="#" className="hover:text-slate-200 transition">How It Works</a></li>
                <li><a href="#" className="hover:text-slate-200 transition">FAQ</a></li>
                <li><a href="#" className="hover:text-slate-200 transition">Blog</a></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-slate-200 mb-3">Company</div>
              <ul className="space-y-2 text-slate-400 text-xs">
                <li><a href="#" className="hover:text-slate-200 transition">About</a></li>
                <li><a href="#" className="hover:text-slate-200 transition">Contact</a></li>
                <li><a href="#" className="hover:text-slate-200 transition">Press</a></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-slate-200 mb-3">Legal</div>
              <ul className="space-y-2 text-slate-400 text-xs">
                <li><a href="#" className="hover:text-slate-200 transition">Privacy</a></li>
                <li><a href="#" className="hover:text-slate-200 transition">Terms</a></li>
                <li><a href="#" className="hover:text-slate-200 transition">Security</a></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-slate-200 mb-3">Follow</div>
              <ul className="space-y-2 text-slate-400 text-xs">
                <li><a href="#" className="hover:text-slate-200 transition">Twitter</a></li>
                <li><a href="#" className="hover:text-slate-200 transition">LinkedIn</a></li>
                <li><a href="#" className="hover:text-slate-200 transition">GitHub</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-xs text-slate-500">
            <p>© 2024 optirate. All rights reserved. | Powered by FinBox Multi-Lender Auction Engine</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
