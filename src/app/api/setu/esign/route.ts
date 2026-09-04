import { NextResponse } from 'next/server';

const headers = () => ({
  'Content-Type': 'application/json',
  'x-client-id': process.env.SETU_ESIGN_CLIENT_ID || '',
  'x-client-secret': process.env.SETU_ESIGN_CLIENT_SECRET || '',
  'x-product-instance-id': process.env.SETU_ESIGN_INSTANCE_ID || '',
});

const requiredConfig = ['SETU_ESIGN_CLIENT_ID', 'SETU_ESIGN_CLIENT_SECRET', 'SETU_ESIGN_INSTANCE_ID', 'SETU_ESIGN_DOCUMENT_ID', 'SETU_ESIGN_REDIRECT_URL'] as const;

export async function GET() {
  const missing = requiredConfig.filter((key) => !process.env[key]);
  return NextResponse.json({
    hostedAvailable: missing.length === 0,
    environment: (process.env.SETU_ESIGN_BASE_URL || 'https://dg-sandbox.setu.co').includes('sandbox') ? 'sandbox' : 'production',
    missing,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === 'SIMULATE_INITIATE') {
      if (!body.signerIdentifier || !body.displayName) return NextResponse.json({ error: 'Signer details are required' }, { status: 400 });
      return NextResponse.json({ id: `sim_esign_${crypto.randomUUID()}`, status: 'otp_sent', mode: 'simulated_aadhaar_otp', mobileLastFour: String(body.signerIdentifier).slice(-4) });
    }
    if (body.action === 'SIMULATE_VERIFY') {
      if (!String(body.id || '').startsWith('sim_esign_')) return NextResponse.json({ error: 'Invalid simulated signature request' }, { status: 400 });
      if (body.otp !== '123456') return NextResponse.json({ error: 'Invalid simulated OTP. Use 123456.' }, { status: 401 });
      return NextResponse.json({ id: body.id, status: 'sign_complete', mode: 'simulated_aadhaar_otp', signedAt: new Date().toISOString() });
    }
    if (body.action === 'INITIATE') {
      if (!body.signerIdentifier || !body.displayName) return NextResponse.json({ error: 'Signer details are required' }, { status: 400 });
      if (!process.env.SETU_ESIGN_CLIENT_ID) return NextResponse.json({ error: 'Setu hosted eSign is not configured. Choose Simulated Aadhaar OTP for the local demo.' }, { status: 503 });
      const documentId = body.documentId || process.env.SETU_ESIGN_DOCUMENT_ID;
      const redirectUrl = body.redirectUrl || process.env.SETU_ESIGN_REDIRECT_URL;
      if (!documentId || !redirectUrl) return NextResponse.json({ error: 'Setu eSign document and public redirect URL must be configured' }, { status: 503 });
      const response = await fetch(`${process.env.SETU_ESIGN_BASE_URL || 'https://dg-sandbox.setu.co'}/api/signature`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ documentId, redirectUrl, signers: [{ identifier: body.signerIdentifier, displayName: body.displayName, signature: { onPages: ['all'], position: 'bottom-right' } }] }),
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) return NextResponse.json({ error: data?.error?.detail || 'Setu eSign initiation failed', provider: data }, { status: response.status });
      const signingUrl = data?.signers?.[0]?.url || data?.url || data?.signingUrl || data?.redirectUrl;
      if (!data?.id || !signingUrl) return NextResponse.json({ error: 'Setu created an incomplete signature response', providerStatus: data?.status }, { status: 502 });
      return NextResponse.json({ ...data, signingUrl });
    }
    if (body.action === 'STATUS' && body.id) {
      const response = await fetch(`${process.env.SETU_ESIGN_BASE_URL || 'https://dg-sandbox.setu.co'}/api/signature/${encodeURIComponent(body.id)}`, { headers: headers(), cache: 'no-store' });
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json({ error: 'Unsupported eSign action' }, { status: 400 });
  } catch (error) {
    console.error('Setu eSign error:', error);
    return NextResponse.json({ error: 'Unable to process eSign request' }, { status: 500 });
  }
}
