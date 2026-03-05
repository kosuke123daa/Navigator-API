import { NextRequest, NextResponse } from 'next/server';
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
