import { NextResponse } from 'next/server';
import { SetuAAService } from '@/services/setuAAService';
import { evaluateBorrower } from '@/services/riskEngine';
import { buildSixMonthStatement, getMockAAProfile } from '@/services/mockAAProfiles';

/**
 * Orchestrator API for Setu AA Consent Flows
 * Features automatic server-side mock generation to bypass sandbox compliance locks.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, mobileNumber, consentId, sessionId, profileId } = body;
    const mockProfile = getMockAAProfile(profileId);

    const isMockMode = process.env.MOCK_SETU === 'true' || !process.env.SETU_AA_CLIENT_ID;

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
            status: 'PENDING',
            profile: mockProfile,
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
            linkedAccounts: [{ FIP: mockProfile.account.fip, accountType: mockProfile.account.accountType, maskedAccountNumber: mockProfile.account.maskedAccountNumber }],
            profile: mockProfile,
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
          const accountTransactions = buildSixMonthStatement(mockProfile.id);
          const risk = evaluateBorrower(accountTransactions);
          const monthlyIncome = Math.round(accountTransactions.filter((transaction) => transaction.direction === 'INFLOW').reduce((sum, transaction) => sum + transaction.grossAmount, 0) / 6);
          const monthlyExpense = Math.round(accountTransactions.filter((transaction) => transaction.direction === 'OUTFLOW').reduce((sum, transaction) => sum + transaction.grossAmount, 0) / 6);
          const fixedMonthlyObligations = Math.round(accountTransactions.filter((transaction) => transaction.direction === 'OUTFLOW' && ['EMI', 'CREDIT_CARD_PAYMENT'].includes(transaction.category)).reduce((sum, transaction) => sum + transaction.grossAmount, 0) / 6);

          console.log(`🚀 [Setu Mock Mode] Fetching Mock Decrypted Bank Statement Data`);
          console.log(`[Risk Simulation] AA consent metrics | SRI ${risk.score} | Action ${risk.action}`);
          return NextResponse.json({
            success: true,
            data: {
              account: {
                transactions: accountTransactions,
                summary: { balance: accountTransactions.at(-1)?.balance || 0, type: mockProfile.account.accountType, monthlyIncome, netMonthlyIncome: monthlyIncome, monthlyExpense, fixedMonthlyObligations, currentDtiPercent: Number((fixedMonthlyObligations / Math.max(monthlyIncome, 1) * 100).toFixed(2)), statementMonths: 6 }
              },
              profile: mockProfile,
              underwriting: risk,
            },
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
