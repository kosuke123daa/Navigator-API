import { NextResponse } from 'next/server';
import docusign from 'docusign-esign';

const NAVIGATOR_BASE = 'https://api-d.docusign.com';

async function getAccessToken(): Promise<string> {
  const apiClient = new docusign.ApiClient();
  apiClient.setOAuthBasePath('account-d.docusign.com');

  const result = await apiClient.requestJWTUserToken(
    process.env.DOCUSIGN_INTEGRATION_KEY!,
    process.env.DOCUSIGN_USER_ID!,
    ['signature', 'impersonation', 'navigator.agreements:read'],
    Buffer.from(process.env.DOCUSIGN_PRIVATE_KEY!),
    3600
  );
  return result.body.access_token;
}

export async function GET() {
  try {
    const accountId = process.env.DOCUSIGN_API_ACCOUNT_ID!;
    console.log('[health] accountId:', accountId);
    console.log('[health] integrationKey:', process.env.DOCUSIGN_INTEGRATION_KEY);
    console.log('[health] userId:', process.env.DOCUSIGN_USER_ID);

    const token = await getAccessToken();
    console.log('[health] JWT token obtained, length:', token.length);

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
    const sdkBody = (err as { response?: { body?: unknown } })?.response?.body;
    const message = err instanceof Error ? err.message : String(err);
    const detail = sdkBody ? JSON.stringify(sdkBody) : message;
    console.error('[health] error:', detail);
    return NextResponse.json({ ok: false, status: 0, detail }, { status: 200 });
  }
}
