import { NextResponse } from 'next/server';
import { SetuAAService } from '@/services/setuAAService';

/**
 * Orchestrator API for Setu AA Consent Flows
 * Features automatic server-side mock generation to bypass sandbox compliance locks.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, mobileNumber, consentId, sessionId } = body;

    const isMockMode = process.env.MOCK_SETU === 'true';

    // Route Action Handlers
    switch (action) {
      case 'INITIATE':
        if (!mobileNumber) {
          return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
        }

        if (isMockMode) {
          console.log(`🚀 [Setu Mock Mode] Simulating Consent Initiation for ${mobileNumber}`);
          return NextResponse.json({
            success: true,
            consentId: `mock_consent_${Date.now()}`,
            url: `https://mock-sandbox.setu.co/v2/decisions/consent?id=mock_consent_${Date.now()}`,
            status: 'PENDING'
          });
        }

        const redirectUrl = `${request.headers.get('origin') || 'http://localhost:3000'}/onboarding-callback`;
        const consentSession = await SetuAAService.initiateConsent({
          mobileNumber,
          redirectUrl,
        });
        return NextResponse.json({ success: true, ...consentSession });

      case 'CHECK_STATUS':
        if (!consentId) {
          return NextResponse.json({ error: 'Consent ID is required' }, { status: 400 });
        }

        if (isMockMode) {
          console.log(`🚀 [Setu Mock Mode] Checking Consent Status for ${consentId}`);
          return NextResponse.json({
            success: true,
            consentId: consentId,
            status: 'ACTIVE', // Instantly active in mock mode for fluid testing
            linkedAccounts: [{ FIP: 'Setu Mock Bank', accountType: 'SAVINGS' }]
          });
        }

        const statusReport = await SetuAAService.getConsentStatus(consentId);
        return NextResponse.json({ success: true, ...statusReport });

      case 'CREATE_SESSION':
        if (!consentId) {
          return NextResponse.json({ error: 'Consent ID is required' }, { status: 400 });
        }

        if (isMockMode) {
          console.log(`🚀 [Setu Mock Mode] Creating Mock Data Session for ${consentId}`);
          return NextResponse.json({
            success: true,
            sessionId: `mock_session_${Date.now()}`,
            status: 'COMPLETED'
          });
        }

        const sessionReport = await SetuAAService.createDataSession(consentId);
        return NextResponse.json({ success: true, ...sessionReport });

      case 'FETCH_DATA':
        if (!sessionId) {
          return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
        }

        if (isMockMode) {
          console.log(`🚀 [Setu Mock Mode] Fetching Mock Decrypted Bank Statement Data`);
          return NextResponse.json({
            success: true,
            data: {
              account: {
                transactions: [
                  { date: '2026-06-01', amount: 120000, type: 'DEBIT', narration: 'Salary Credit' },
                  { date: '2026-06-05', amount: 40000, type: 'CREDIT', narration: 'Rent Payment' },
                  { date: '2026-06-12', amount: 15000, type: 'CREDIT', narration: 'Credit Card Bill' }
                ],
                summary: { balance: 145000, type: 'SAVINGS' }
              }
            }
          });
        }

        const statementData = await SetuAAService.fetchDecryptedData(sessionId);
        return NextResponse.json({ success: true, data: statementData });

      default:
        return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('API Orchestration Failure:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}