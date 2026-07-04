import { BankSchemaAdapter, StandardBorrowerProfile } from './bankAdapterService';
import { LoanBid } from '../types/lending';

// Internal mathematical helper for EMI computations (used as a fallback)
const calculateEMI = (principal: number, annualRate: number, months: number): number => {
  if (annualRate === 0) return principal / months;
  const monthlyRate = annualRate / 12 / 100;
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );
};

// Define internal properties for simulated remote fallback rules
const INTERNAL_BANK_METADATA = [
  { id: 'lender_01', name: 'IDFC First Bank', baseRate: 10.25, feePercent: 0.5, probability: 0.85 },
  { id: 'lender_02', name: 'Navi Finserv', baseRate: 9.90, feePercent: 0.0, probability: 0.70 },
  { id: 'lender_03', name: 'Kotak Mahindra Bank', baseRate: 10.75, feePercent: 0.8, probability: 0.80 }
];

// -----------------------------------------------------------------------------
// WIREMOCK API CONFIGURATION
// Replace the placeholder URLs below with your actual WireMock endpoint links!
// -----------------------------------------------------------------------------
const WIREMOCK_ENDPOINTS: Record<string, string> = {
  'lender_01': 'https://91154.wiremockapi.cloud/api/idfc/underwrite',     // IDFC First Bank WireMock Link
  'lender_02': 'https://gddm9.wiremockapi.cloud/api/navi/underwrite',     // Navi Finserv WireMock Link
  'lender_03': 'https://766w3.wiremockapi.cloud/api/kotak/underwrite',   // Kotak Mahindra Bank WireMock Link
};

export async function runReverseAuction(
  principalAmount: number, 
  tenureMonths: number, 
  creditScore: number,
  monthlyIncome: number = 100000,
  monthlyExpense: number = 30000
): Promise<LoanBid[]> {
  
  // Dynamic network connection handshake emulation
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Pack standard user criteria matching standard profiles
  const platformProfile: StandardBorrowerProfile = {
    fullName: "Borrower Profile Summary",
    requiredAmount: principalAmount,
    tenureMonths: tenureMonths,
    creditScore: creditScore,
    monthlyIncome: monthlyIncome,
    monthlyExpense: monthlyExpense
  };

  console.log(`\n=================== Reverse-Auction Broadcast Engine ===================`);
  console.log(`📡 Dispatched Criteria: Amount: ₹${principalAmount.toLocaleString()}, score: ${creditScore}, Income: ₹${monthlyIncome.toLocaleString()}`);

  // Use Promise.all to map the API requests concurrently so we execute fetches in parallel
  const bids: LoanBid[] = await Promise.all(
    INTERNAL_BANK_METADATA.map(async (bank) => {
      
      // Step 1: Mapping outbound payload to target vendor schema dynamically using your Adapter
      const customBankPayload = BankSchemaAdapter.toBankRequestPayload(bank.id, {
        ...platformProfile,
        fullName: bank.id === 'lender_01' ? 'IDFC CLIENT' : 'Navi Client'
      });

      console.log(`\n💼 1. Mapped Payload Outbound for: ${bank.name}`);
      console.log(JSON.stringify(customBankPayload, null, 2));

      let mockBankResponse: any = null;
      let usedWireMock = false;
      const wiremockUrl = WIREMOCK_ENDPOINTS[bank.id];

      // Step 2: Dispatch actual WireMock API HTTP call if user configured a valid URL
      if (wiremockUrl && !wiremockUrl.includes('your-wiremock-id')) {
        try {
          console.log(`🚀 Sending POST request to WireMock for ${bank.name}... Url: ${wiremockUrl}`);
          const response = await fetch(wiremockUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(customBankPayload)
          });

          if (response.ok) {
            mockBankResponse = await response.json();
            usedWireMock = true;
            console.log(`📡 [WireMock SUCCESS] Received custom native response from ${bank.name}:`);
            console.log(JSON.stringify(mockBankResponse, null, 2));
          } else {
            console.warn(`⚠️ WireMock endpoint returned status ${response.status}. Falling back to internal engine.`);
          }
        } catch (error) {
          console.warn(`⚠️ Network connection failed for WireMock: ${bank.name}. Using default fallback simulation.`);
        }
      }

      // Fallback: If WireMock is not configured or fails, simulate native responses locally
      if (!usedWireMock) {
        let isApproved = Math.random() < bank.probability && creditScore > 650;
        const riskPremium = creditScore > 750 ? 0 : (750 - creditScore) * 0.025;
        const finalRate = bank.baseRate + riskPremium;

        const proposedEMI = calculateEMI(principalAmount, finalRate, tenureMonths);
        const dtiRatio = (monthlyExpense + proposedEMI) / Math.max(1, monthlyIncome);

        // Underwrite restriction: surge failure if debt obligations cross 55%
        if (dtiRatio > 0.55) {
          isApproved = false;
        }

        if (bank.id === 'lender_01') {
          mockBankResponse = {
            TX_STATUS: isApproved ? 'APRVD' : 'REJTD',
            RATE_ANN_PCT: parseFloat(finalRate.toFixed(2)),
            EMI_EST_MO_VAL: Math.round(proposedEMI),
            FE_PROC_VAL: Math.round(principalAmount * (bank.feePercent / 100)),
            OUTFLOW_TOT_VAL: Math.round((proposedEMI * tenureMonths) + (principalAmount * (bank.feePercent / 100)))
          };
        } else if (bank.id === 'lender_02') {
          mockBankResponse = {
            decisioning: {
              verdict: isApproved ? 'ELIGIBLE' : 'INELIGIBLE',
              pricing: isApproved ? {
                aprPercent: parseFloat(finalRate.toFixed(2)),
                monthlyPayment: Math.round(proposedEMI),
                originationCharge: bank.feePercent,
                aggregateOutflow: Math.round((proposedEMI * tenureMonths))
              } : undefined
            }
          };
        } else {
          mockBankResponse = {
            DEC_CODE: isApproved ? 'A01' : 'R01',
            INT_R: isApproved ? parseFloat(finalRate.toFixed(2)) : undefined,
            M_EMI: isApproved ? Math.round(proposedEMI) : undefined,
            PF_PCT: isApproved ? bank.feePercent : undefined,
            TOT_PAY: isApproved ? Math.round((proposedEMI * tenureMonths) + (principalAmount * (bank.feePercent / 100))) : undefined
          };
        }
        console.log(`📥 2. [Local Fallback] response built for ${bank.name}:`);
        console.log(JSON.stringify(mockBankResponse, null, 2));
      }

      // Step 3: Parse response through Adapter back to standard platform Model
      const normalizedData = BankSchemaAdapter.toStandardBid(bank.id, mockBankResponse, principalAmount);

      if (normalizedData.status === 'Rejected') {
        return {
          id: `bid_${bank.id}_${Date.now()}`,
          lenderId: bank.id,
          lenderName: bank.name,
          baseInterestRate: 0,
          processingFeePercent: 0,
          calculatedAPR: 0,
          monthlyEMI: 0,
          totalPayout: 0,
          rank: 999,
          status: 'Rejected',
        };
      }

      const calculatedAPR = normalizedData.interestRate + (normalizedData.feePercent / (tenureMonths / 12));

      return {
        id: `bid_${bank.id}_${Date.now()}`,
        lenderId: bank.id,
        lenderName: bank.name,
        lenderLogo: `https://placehold.co/120x40/e2e8f0/1e293b?text=${bank.name.replace(/ /g, '+')}`,
        baseInterestRate: normalizedData.interestRate,
        processingFeePercent: normalizedData.feePercent,
        calculatedAPR: parseFloat(calculatedAPR.toFixed(2)),
        monthlyEMI: normalizedData.emi,
        totalPayout: normalizedData.totalPayout,
        rank: 0,
        status: 'Approved',
      };
    })
  );

  // Step 4: Filtering and ordering by cheapest APR
  const approvedBids = bids.filter(bid => bid.status === 'Approved');
  approvedBids.sort((a, b) => a.calculatedAPR - b.calculatedAPR);

  const rankedBids = approvedBids.map((bid, index) => ({
    ...bid,
    rank: index + 1
  }));

  console.log(`\n=================== Auction Translation Run Complete ===================\n`);

  return rankedBids;
}