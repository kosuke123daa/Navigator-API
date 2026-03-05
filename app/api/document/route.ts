import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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
    console.log('[document] agreementId:', agreementId);
    const token = await getAccessToken();

    // Get agreement to find document URL
    const agreementRes = await fetch(
      `https://api-d.docusign.com/v1/accounts/${accountId}/agreements/${agreementId}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    );

    if (!agreementRes.ok) {
      const body = await agreementRes.text();
      return NextResponse.json({ error: `Agreement fetch failed: ${agreementRes.status}`, detail: body }, { status: agreementRes.status });
    }

    const agreement = await agreementRes.json() as { _links?: { document?: { href?: string } } };
    const documentUrl = agreement._links?.document?.href;

    if (!documentUrl) {
      return NextResponse.json({ error: 'No document URL in agreement' }, { status: 404 });
    }

    // Try without auth first (document-public-dms may be publicly accessible)
    console.log('[document] fetching document URL:', documentUrl);
    let docRes = await fetch(documentUrl, { cache: 'no-store' });
    console.log('[document] no-auth response status:', docRes.status);

    // If that fails, retry with Bearer token
    if (!docRes.ok) {
      console.log('[document] retrying with Bearer token');
      docRes = await fetch(documentUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      console.log('[document] with-auth response status:', docRes.status);
    }

    if (!docRes.ok) {
      return NextResponse.json({ error: `Document fetch failed: ${docRes.status}` }, { status: docRes.status });
    }

    console.log('[document] doc response status:', docRes.status);
    const contentType = docRes.headers.get('content-type') ?? 'application/octet-stream';
    const body = await docRes.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[document] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
