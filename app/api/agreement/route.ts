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
    const token = await getAccessToken();

    const res = await fetch(
      `${NAVIGATOR_BASE}/v1/accounts/${accountId}/agreements/${agreementId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `Navigator API error: ${res.status}`, detail: body },
        { status: res.status }
      );
    }

    const data = await res.json();
    const documentUrl: string | undefined = data?._links?.document?.href;

    return NextResponse.json({ documentUrl, agreement: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
