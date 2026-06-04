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
              We charge lenders a fixed fee:
              <span className="text-slate-300 font-medium"> 1% for loans up to ₹10 Lacs</span>
              {' | '}
              <span className="text-slate-300 font-medium">₹10,000 + 0.5% for loans above ₹10 Lacs</span>
              . No hidden markups. Lenders compete purely on the APR offered to you. Your rate is determined solely by competitive market forces.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
