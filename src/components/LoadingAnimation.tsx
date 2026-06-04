'use client';

interface LoadingStepProps {
  steps: string[];
  currentStep: number;
}

export const LoadingAnimation = ({ steps, currentStep }: LoadingStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="inline-block">
          <div className="animate-spin">
            <svg className="w-12 h-12 text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </div>
        <h3 className="text-2xl font-bold text-slate-100 mt-4">Launching Your Auction</h3>
        <p className="text-slate-400 text-sm mt-2">Securing connection to FinBox Multi-Lender Sandbox Engine...</p>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <div className="flex-shrink-0">
              {index < currentStep ? (
                <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">✓</span>
                </div>
              ) : index === currentStep ? (
                <div className="w-6 h-6 animate-pulse bg-primary-400 rounded-full"></div>
              ) : (
                <div className="w-6 h-6 bg-slate-600 rounded-full"></div>
              )}
            </div>
            <span className={`text-sm ${
              index <= currentStep ? 'text-slate-100' : 'text-slate-500'
            }`}>
              {step}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-slate-700">
        <p className="text-xs text-slate-400 text-center">
          This typically takes 4-5 seconds. We're broadcasting your anonymized profile to 12 partner lenders.
        </p>
      </div>
    </div>
  );
};
