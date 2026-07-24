import { NextResponse } from 'next/server';
import { SetuAAService } from '@/services/setuAAService';
import { calculateAdjustedSRI, calculateThermodynamicRiskMetrics, evaluateBorrowerRisk, type CashflowTransaction } from '@/services/riskEngine';

/**
 * Orchestrator API for Setu AA Consent Flows
 * Features automatic server-side mock generation to bypass sandbox compliance locks.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, mobileNumber, consentId, sessionId } = body;

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
          const now = new Date();
          const accountTransactions: CashflowTransaction[] = [
            { date: new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString(), amount: 120000, direction: 'INFLOW', narration: 'salary credit', category: 'SALARY', counterpartyEntityHash: 'TATA_EMPLOYER_CORP_HASH' },
            { date: new Date(now.getFullYear(), now.getMonth() - 10, 1).toISOString(), amount: 120000, direction: 'INFLOW', narration: 'salary credit', category: 'SALARY', counterpartyEntityHash: 'TATA_EMPLOYER_CORP_HASH' },
            { date: new Date(now.getFullYear(), now.getMonth() - 9, 1).toISOString(), amount: 120000, direction: 'INFLOW', narration: 'salary credit', category: 'SALARY', counterpartyEntityHash: 'TATA_EMPLOYER_CORP_HASH' },
            { date: new Date(now.getFullYear(), now.getMonth() - 8, 1).toISOString(), amount: 120000, direction: 'INFLOW', narration: 'salary credit', category: 'SALARY', counterpartyEntityHash: 'TATA_EMPLOYER_CORP_HASH' },
            { date: new Date(now.getFullYear(), now.getMonth() - 7, 1).toISOString(), amount: 120000, direction: 'INFLOW', narration: 'salary credit', category: 'SALARY', counterpartyEntityHash: 'TATA_EMPLOYER_CORP_HASH' },
            { date: new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString(), amount: 120000, direction: 'INFLOW', narration: 'salary credit', category: 'SALARY', counterpartyEntityHash: 'TATA_EMPLOYER_CORP_HASH' },
            { date: new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString(), amount: 45000, direction: 'OUTFLOW', narration: 'rent utility emi', category: 'RENT', counterpartyEntityHash: 'UTILITY_BILLER_HASH' },
            { date: new Date(now.getFullYear(), now.getMonth() - 4, 1).toISOString(), amount: 250000, direction: 'INFLOW', narration: 'fixed deposit maturity', category: 'FIXED_DEPOSIT', counterpartyEntityHash: 'FIXED_DEPOSIT_MATURITY_HASH' },
            { date: new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString(), amount: 20000, direction: 'OUTFLOW', narration: 'credit card bill', category: 'CREDIT_CARD', counterpartyEntityHash: 'CREDIT_CARD_HASH' },
            { date: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(), amount: 12000, direction: 'OUTFLOW', narration: 'internet emi', category: 'UTILITY', counterpartyEntityHash: 'UTILITY_BILLER_HASH' },
          ];

          const baseRisk = evaluateBorrowerRisk({
            creditScore: 660,
            monthlyIncome: 120000,
            monthlyExpense: 42000,
            isFirstTimeBorrower: true,
            transactions: accountTransactions,
          });
          const thermoMetrics = calculateThermodynamicRiskMetrics(accountTransactions);
          const adjustedSRI = calculateAdjustedSRI(baseRisk.sri, thermoMetrics);

          console.log(`🚀 [Setu Mock Mode] Fetching Mock Decrypted Bank Statement Data`);
          console.log(`[Risk Simulation] AA consent metrics | SRI ${baseRisk.sri} | Adjusted SRI ${adjustedSRI} | entropyDelta ${thermoMetrics.entropyDelta} | wasteHeatRatio ${thermoMetrics.wasteHeatRatio}`);
          return NextResponse.json({
            success: true,
            data: {
              account: {
                transactions: accountTransactions,
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