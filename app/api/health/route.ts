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

    // JWT トークン取得を確認
    const token = await getAccessToken();

    // Navigator API の agreements 一覧を limit=1 で叩いてアクセス確認
    const res = await fetch(
      `${NAVIGATOR_BASE}/v1/accounts/${accountId}/agreements?limit=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    );

    const body = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, status: res.status, detail: body },
        { status: 200 } // UI 側で判定するため常に 200 で返す
      );
    }

    return NextResponse.json({ ok: true, status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, status: 0, detail: message }, { status: 200 });
  }
}
