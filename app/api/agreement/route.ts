import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const NAVIGATOR_BASE = 'https://api-d.docusign.com';
const AUTH_BASE = 'https://account-d.docusign.com';

async function getAccessToken(): Promise<string> {
  const privateKey = process.env.DOCUSIGN_PRIVATE_KEY!.replace(/\\n/g, '\n');
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY!;
  const userId = process.env.DOCUSIGN_USER_ID!;

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'RS256' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: integrationKey,
    sub: userId,
    aud: 'account-d.docusign.com',
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation adm_store_unified_repo_read',
  })).toString('base64url');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(privateKey, 'base64url');
  const jwt = `${header}.${payload}.${signature}`;

  const tokenRes = await fetch(`${AUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string };
  if (!tokenData.access_token) {
    throw new Error(`OAuth error: ${tokenData.error} - ${tokenData.error_description}`);
  }
  return tokenData.access_token;
}

export async function GET(request: NextRequest) {
  const agreementId = request.nextUrl.searchParams.get('id');
  if (!agreementId) {
    return NextResponse.json({ error: 'Agreement ID is required' }, { status: 400 });
  }

  try {
    const accountId = process.env.DOCUSIGN_API_ACCOUNT_ID!;
    console.log('[agreement] accountId:', accountId);
    console.log('[agreement] agreementId:', agreementId);

    const token = await getAccessToken();
    console.log('[agreement] JWT token obtained');

    const url = `${NAVIGATOR_BASE}/v1/accounts/${accountId}/agreements/${agreementId}`;
    console.log('[agreement] fetching:', url);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    const body = await res.text();
    console.log('[agreement] response status:', res.status);
    console.log('[agreement] response body:', body);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Navigator API error: ${res.status}`, detail: body },
        { status: res.status }
      );
    }

    const data = JSON.parse(body);
    const documentUrl: string | undefined = data?._links?.document?.href;

    return NextResponse.json({ documentUrl, agreement: data });
  } catch (err: unknown) {
    const sdkBody = (err as { response?: { body?: unknown } })?.response?.body;
    const message = err instanceof Error ? err.message : String(err);
    const detail = sdkBody ? JSON.stringify(sdkBody) : message;
    console.error('[agreement] error:', detail);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
