import { NextResponse } from 'next/server';
import { runReverseAuction } from '@/services/auctionService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const numeric = ['requiredAmount', 'tenureMonths', 'creditScore', 'monthlyIncome', 'monthlyExpense', 'cashflowRiskScore'] as const;
    if (numeric.some((key) => !Number.isFinite(body[key])) || body.requiredAmount <= 0 || body.tenureMonths <= 0 || !body.fullName) {
      return NextResponse.json({ error: 'Invalid auction profile' }, { status: 400 });
    }
    const bids = await runReverseAuction({
      fullName: body.fullName,
      requiredAmount: body.requiredAmount,
      tenureMonths: body.tenureMonths,
      creditScore: body.creditScore,
      monthlyIncome: body.monthlyIncome,
      monthlyExpense: body.monthlyExpense,
      fixedMonthlyObligations: body.fixedMonthlyObligations || 0,
      cashflowRiskScore: Math.max(0, Math.min(100, body.cashflowRiskScore)),
      cashflowRiskAction: body.cashflowRiskAction,
      borrowerSegment: body.borrowerSegment,
    });
    return NextResponse.json({ auctionId: crypto.randomUUID(), createdAt: new Date().toISOString(), bids });
  } catch (error) {
    console.error('Auction orchestration failed:', error);
    return NextResponse.json({ error: 'Unable to obtain lender offers' }, { status: 502 });
  }
}
