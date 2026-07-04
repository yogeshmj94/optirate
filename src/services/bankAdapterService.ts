// Standard platform profile used by our UI and common layers
export interface StandardBorrowerProfile {
  fullName: string;
  requiredAmount: number;
  tenureMonths: number;
  creditScore: number;
  monthlyIncome: number;
  monthlyExpense: number;
}

// -----------------------------------------------------------------------------
// LEGACY CORES: Wilder and custom schemas for our three distinct partner banks
// -----------------------------------------------------------------------------

// Schema A: IDFC First Bank (Legacy Corporate DB format: Uppercase, Underscored keys)
export interface IDFCFirstRequest {
  CUST_ID_NUM: string;
  F_NAME: string;
  L_NAME: string;
  REQU_AMT_VAL: number;
  TERM_MO_VAL: number;
  CRED_SCOR_VAL: number;
  INC_MO_VAL: number;
  EXP_MO_VAL: number;
}

export interface IDFCFirstResponse {
  TX_STATUS: "APRVD" | "REJTD";
  RATE_ANN_PCT: number;
  EMI_EST_MO_VAL: number;
  FE_PROC_VAL: number;
  OUTFLOW_TOT_VAL: number;
}


// Schema B: Navi Finserv (Fintech GraphQL style: Highly Nested Structures)
export interface NaviRequest {
  applicant: {
    personal: {
      fullName: string;
    };
    financials: {
      monthlyRevenue: number;
      monthlyDebtObligations: number;
    };
    riskProfile: {
      bureauScore: number;
    };
  };
  deal: {
    principalRequested: number;
    amortizationPeriodMonths: number;
  };
}

export interface NaviResponse {
  decisioning: {
    verdict: "ELIGIBLE" | "INELIGIBLE";
    pricing?: {
      aprPercent: number;
      monthlyPayment: number;
      originationCharge: number;
      aggregateOutflow: number;
    };
  };
}

// Schema C: Kotak Mahindra Bank (Cryptic Mainframe Abbreviations)
export interface KotakRequest {
  FULL_NM: string;
  AMT_REQ: number;
  TEN_M: number;
  CS_VAL: number;
  M_INC: number;
  M_EXP: number;
}

export interface KotakResponse {
  DEC_CODE: "A01" | "R01"; // A01 = Approved, R01 = Rejected
  INT_R?: number;
  M_EMI?: number;
  PF_PCT?: number;
  TOT_PAY?: number;
}


export class BankSchemaAdapter {
  
  /**
   * Translates unified platform state to a custom bank's specific payload format.
   */
  public static toBankRequestPayload(bankId: string, profile: StandardBorrowerProfile): any {
    const nameParts = profile.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Borrower';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ' ';

    switch (bankId) {
      case 'lender_01': // IDFC First Bank
        return {
          CUST_ID_NUM: `CUST_${Date.now()}`,
          F_NAME: firstName,
          L_NAME: lastName,
          REQU_AMT_VAL: profile.requiredAmount,
          TERM_MO_VAL: profile.tenureMonths,
          CRED_SCOR_VAL: profile.creditScore,
          INC_MO_VAL: profile.monthlyIncome,
          EXP_MO_VAL: profile.monthlyExpense
        } as IDFCFirstRequest;

      case 'lender_02': // Navi Finserv
        return {
          applicant: {
            personal: { fullName: profile.fullName },
            financials: {
              monthlyRevenue: profile.monthlyIncome,
              monthlyDebtObligations: profile.monthlyExpense
            },
            riskProfile: { bureauScore: profile.creditScore }
          },
          deal: {
            principalRequested: profile.requiredAmount,
            amortizationPeriodMonths: profile.tenureMonths
          }
        } as NaviRequest;

      case 'lender_03': // Kotak Mahindra Bank
        return {
          FULL_NM: profile.fullName,
          AMT_REQ: profile.requiredAmount,
          TEN_M: profile.tenureMonths,
          CS_VAL: profile.creditScore,
          M_INC: profile.monthlyIncome,
          M_EXP: profile.monthlyExpense
        } as KotakRequest;

      default:
        throw new Error(`Unhandled Bank ID inside payload adapter: ${bankId}`);
    }
  }


  /**
   * Translates non-standard vendor results back into our unified platform format.
   */
  public static toStandardBid(
    bankId: string, 
    bankResponse: any, 
    originalPrincipal: number
  ): { status: string; interestRate: number; emi: number; feePercent: number; totalPayout: number } {
    
    switch (bankId) {
      case 'lender_01': { // IDFC First Bank
        const res = bankResponse as IDFCFirstResponse;
        return {
          status: res.TX_STATUS === 'APRVD' ? 'Approved' : 'Rejected',
          interestRate: res.RATE_ANN_PCT,
          emi: res.EMI_EST_MO_VAL,
          feePercent: originalPrincipal > 0 ? (res.FE_PROC_VAL / originalPrincipal) * 100 : 0,
          totalPayout: res.OUTFLOW_TOT_VAL
        };
      }

      case 'lender_02': { // Navi Finserv
        const res = bankResponse as NaviResponse;
        const approved = res.decisioning.verdict === 'ELIGIBLE' && res.decisioning.pricing;
        return {
          status: approved ? 'Approved' : 'Rejected',
          interestRate: approved ? res.decisioning.pricing!.aprPercent : 0,
          emi: approved ? res.decisioning.pricing!.monthlyPayment : 0,
          feePercent: approved ? res.decisioning.pricing!.originationCharge : 0,
          totalPayout: approved ? res.decisioning.pricing!.aggregateOutflow : 0
        };
      }

      case 'lender_03': { // Kotak Mahindra Bank
        const res = bankResponse as KotakResponse;
        const approved = res.DEC_CODE === 'A01';
        return {
          status: approved ? 'Approved' : 'Rejected',
          interestRate: approved ? res.INT_R || 0 : 0,
          emi: approved ? res.M_EMI || 0 : 0,
          feePercent: approved ? res.PF_PCT || 0 : 0,
          totalPayout: approved ? res.TOT_PAY || 0 : 0
        };
      }

      default:
        return { status: 'Rejected', interestRate: 0, emi: 0, feePercent: 0, totalPayout: 0 };
    }
  }
}