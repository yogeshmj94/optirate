/**
 * Setu Account Aggregator Integration Service
 * Implements standard OAuth 2.0 Token Generation Flow & Consent Lifecycle
 */

const SETU_AA_BASE_URL = process.env.SETU_AA_BASE_URL || 'https://dg-sandbox.setu.co';

export interface SetuConsentConfig {
  mobileNumber: string;
  redirectUrl: string;
  purposeText?: string;
  durationMonths?: number;
}

export class SetuAAService {
  private static cachedToken: string | null = null;
  private static tokenExpiry: number = 0; // Epoch timestamp

  /**
   * Helper to fetch/refresh the OAuth 2.0 access token dynamically
   * Authenticates against Setu's Org Identity Service using Client Credentials flow
   */
  private static async getBearerToken(): Promise<string> {
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Return cached token if valid (buffer of 30 seconds before actual expiration)
    if (this.cachedToken && this.tokenExpiry > currentTime + 30) {
      return this.cachedToken;
    }

    const authUrl = process.env.SETU_AA_AUTH_URL || 'https://orgservice-sandbox.setu.co/v1/users/login';
    const clientID = process.env.SETU_AA_CLIENT_ID || '';
    const secret = process.env.SETU_AA_CLIENT_SECRET || '';

    console.log('🔑 [Setu OAuth] Fetching fresh M2M Token for Account Aggregator...');

    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'client': 'bridge',
      },
      body: JSON.stringify({
        clientID,
        grant_type: 'client_credentials',
        secret,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ [Setu OAuth] Authentication Failed:', data);
      throw new Error(data.error?.message || 'Access Token extraction failed via Setu OrgService');
    }

    // Capture standard payload fields (handling both "access_token" and custom token wrappers)
    const token = data.access_token || data.token;
    const expiresIn = data.expires_in || 1800; // Default to 30 mins if not specified

    this.cachedToken = token;
    this.tokenExpiry = currentTime + expiresIn;

    return token;
  }

  /**
   * Generates secure Bearer header configuration for AA API endpoints
   */
  private static async getHeaders(): Promise<HeadersInit> {
    const token = await this.getBearerToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-product-instance-id': process.env.SETU_AA_INSTANCE_ID || '',
    };
  }

  /**
   * Step 1: Create a Consent Request
   */
  public static async initiateConsent(config: SetuConsentConfig) {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);

    const payload = {
      consentDetail: {
        consentMode: 'STORE',
        consentTypes: ['TRANSACTIONS', 'PROFILE', 'SUMMARY'],
        fiTypes: ['DEPOSITS'],
        vua: `${config.mobileNumber}@setu`, // Standard sandbox router VUA
        consentDuration: {
          unit: 'MONTH',
          value: config.durationMonths || 3,
        },
        dataFrequency: {
          unit: 'MONTH',
          value: 1,
        },
        dataLife: {
          unit: 'MONTH',
          value: 12,
        },
        dataRange: {
          from: sixMonthsAgo.toISOString(),
          to: today.toISOString(),
        },
        purpose: {
          code: '105', // Consolidated transaction history matching KYC requirements
          refUri: 'https://optirate.in/privacy-policy',
          text: config.purposeText || 'Underwriting analysis for pre-approved loan bidding.',
          category: {
            type: 'string',
          },
        },
      },
      redirectUrl: config.redirectUrl,
    };

    console.log('📡 [Setu AA] Initiating Consent Request for:', config.mobileNumber);

    const headers = await this.getHeaders();
    const response = await fetch(`${SETU_AA_BASE_URL}/consents`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ [Setu AA] Consent Initiation Error:', data);
      throw new Error(data.error?.message || 'Failed to initiate consent');
    }

    return {
      consentId: data.id,
      url: data.url,
      status: data.status,
    };
  }

  /**
   * Step 2: Fetch Consent Status
   */
  public static async getConsentStatus(consentId: string) {
    console.log(`🔍 [Setu AA] Checking status for Consent: ${consentId}`);

    const headers = await this.getHeaders();
    const response = await fetch(`${SETU_AA_BASE_URL}/consents/${consentId}`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ [Setu AA] Fetch Status Error for ${consentId}:`, data);
      throw new Error(data.error?.message || 'Failed to check consent status');
    }

    return {
      consentId: data.id,
      status: data.status, // PENDING, ACTIVE, REJECTED, EXPIRED, REVOKED
      linkedAccounts: data.consentDetail?.accounts || [],
    };
  }

  /**
   * Step 3: Trigger Data Session Preparation
   */
  public static async createDataSession(consentId: string) {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);

    const payload = {
      consentId: consentId,
      dataRange: {
        from: sixMonthsAgo.toISOString(),
        to: today.toISOString(),
      },
      format: 'json',
    };

    console.log(`⚡ [Setu AA] Creating Data Session for Consent: ${consentId}`);

    const headers = await this.getHeaders();
    const response = await fetch(`${SETU_AA_BASE_URL}/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ [Setu AA] Create Session Error for ${consentId}:`, data);
      throw new Error(data.error?.message || 'Failed to create data session');
    }

    return {
      sessionId: data.id,
      status: data.status,
    };
  }

  /**
   * Step 4: Fetch Decrypted Financial Information
   */
  public static async fetchDecryptedData(sessionId: string) {
    console.log(`📥 [Setu AA] Fetching Decrypted Statement Data for Session: ${sessionId}`);

    const headers = await this.getHeaders();
    const response = await fetch(`${SETU_AA_BASE_URL}/sessions/${sessionId}`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ [Setu AA] Fetch Data Error for Session ${sessionId}:`, data);
      throw new Error(data.error?.message || 'Failed to fetch financial data');
    }

    return data;
  }
}