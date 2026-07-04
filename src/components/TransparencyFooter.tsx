'use client';

export const TransparencyFooter = () => {
  return (
    <div className="mt-12 pt-8 border-t border-slate-700">
      <div className="bg-slate-900/30 border border-slate-700/50 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="text-2xl flex-shrink-0">🔒</div>
          <div>
            <h3 className="font-semibold text-slate-100 mb-2">Platform Transparency Guarantee</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Zero Spam:
              <span className="text-slate-300 font-medium"> Lowest APR</span>
              {' | '}
              <span className="text-slate-300 font-medium">Privacy first platform</span>
              . Only the lender who's bid you accept will know your details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
