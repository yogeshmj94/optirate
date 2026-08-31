import { NextResponse } from 'next/server';
const PAN_PROFILES: Record<string, { full_name: string; first_name: string; last_name: string; category: string }> = {
  ABCDE1234A: {
    full_name: 'AAAAAA',
    first_name: 'AAAAAA',
    last_name: '',
    category: 'Individual or Person',
  },
};

/**
 * KYC PAN Verification Backend Route
 * Automatically falls back to high-fidelity mock data if MOCK_SETU is active.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pan, consent } = body;

    if (!pan) {
      return NextResponse.json({ error: 'PAN is required' }, { status: 400 });
    }

    const isMockMode = process.env.MOCK_SETU === 'true' || !process.env.SETU_KYC_CLIENT_ID;

    if (isMockMode) {
      const profile = PAN_PROFILES[pan as keyof typeof PAN_PROFILES];
      if (!profile) {
        return NextResponse.json({ error: 'Use Setu sandbox valid PAN ABCDE1234A. ABCDE1234B is reserved by Setu for invalid-PAN testing.' }, { status: 400 });
      }

      console.log(`🚀 [Setu Mock Mode] Verifying Mock PAN: ${pan}`);

      return NextResponse.json({
        verification: "SUCCESS",
        id: `mock_txn_${Date.now()}`,
        message: "PAN is valid (Simulated Onboarding).",
        data: {
          full_name: profile.full_name,
          first_name: profile.first_name,
          middle_name: "",
          last_name: profile.last_name,
          category: profile.category,
          aadhaar_seeding_status: "LINKED",
        },
        traceId: `mock-trace-${Date.now()}`
      });
    }

    const setuResponse = await fetch(`${process.env.SETU_KYC_BASE_URL || 'https://dg-sandbox.setu.co'}/api/verify/pan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': process.env.SETU_KYC_CLIENT_ID || '',
        'x-client-secret': process.env.SETU_KYC_CLIENT_SECRET || '',
        'x-product-instance-id': process.env.SETU_PAN_INSTANCE_ID || ''
      },
      body: JSON.stringify({
        pan: pan,
        consent: consent || "Y",
        reason: "Identity verification for OptiRate Loan Application"
      })
    });

    const data = await setuResponse.json();

    if (!setuResponse.ok) {
      console.error("Setu Error:", data);
      return NextResponse.json({ error: 'Verification failed via Setu' }, { status: setuResponse.status });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error("Internal Server Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
