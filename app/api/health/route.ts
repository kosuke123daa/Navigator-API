import { NextResponse } from 'next/server';
import crypto from 'crypto';

const NAVIGATOR_BASE = 'https://api-d.docusign.com';
const AUTH_BASE = 'https://apps-d.docusign.com';

async function getAccessToken(): Promise<string> {
  const privateKey = process.env.DOCUSIGN_PRIVATE_KEY!.replace(/\\n/g, '\n');
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY!;
  const userId = process.env.DOCUSIGN_USER_ID!;

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'RS256' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: integrationKey,
    sub: userId,
    aud: 'apps-d.docusign.com',
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation navigator.agreements:read',
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

  const tokenData = await tokenRes.json() as { access_token?: string; error?: string; error_description?: string; scope?: string };
  console.log('[health] oauth response status:', tokenRes.status);
  console.log('[health] oauth scope granted:', tokenData.scope);
  if (!tokenData.access_token) {
    throw new Error(`OAuth error: ${tokenData.error} - ${tokenData.error_description}`);
  }
  return tokenData.access_token;
}

export async function GET() {
  try {
    const accountId = process.env.DOCUSIGN_API_ACCOUNT_ID!;
    console.log('[health] accountId:', accountId);
    console.log('[health] integrationKey:', process.env.DOCUSIGN_INTEGRATION_KEY);
    console.log('[health] userId:', process.env.DOCUSIGN_USER_ID);

    const token = await getAccessToken();
    console.log('[health] access token obtained, length:', token.length);

    const url = `${NAVIGATOR_BASE}/v1/accounts/${accountId}/agreements?limit=1`;
    console.log('[health] fetching:', url);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    const body = await res.text();
    console.log('[health] response status:', res.status);
    console.log('[health] response body:', body);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, status: res.status, detail: body || `HTTP ${res.status}` },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[health] error:', message);
    return NextResponse.json({ ok: false, status: 0, detail: message }, { status: 200 });
  }
}
