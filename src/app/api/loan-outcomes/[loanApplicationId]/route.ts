import { NextResponse } from 'next/server';
import { listLoanOutcomeSyncs } from '@/services/loanOutcomeSyncRepository';

interface RouteContext {
  params: { loanApplicationId: string };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const outcomeSyncs = await listLoanOutcomeSyncs(context.params.loanApplicationId);
    return NextResponse.json({ outcomeSyncs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read loan outcome';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
