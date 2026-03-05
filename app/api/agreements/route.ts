import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, NAVIGATOR_BASE } from '@/lib/docusign-auth';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = searchParams.get('limit') ?? '50';
  const cursorId = searchParams.get('cursor_id');

  try {
    const accountId = process.env.DOCUSIGN_API_ACCOUNT_ID!;
    const token = await getAccessToken();

    const params = new URLSearchParams({ limit });
    if (cursorId) params.set('cursor_id', cursorId);

    const url = `${NAVIGATOR_BASE}/v1/accounts/${accountId}/agreements?${params}`;
    console.log('[agreements] fetching:', url);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    const body = await res.text();
    console.log('[agreements] response status:', res.status);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Navigator API error: ${res.status}`, detail: body },
        { status: res.status }
      );
    }

    return NextResponse.json(JSON.parse(body));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[agreements] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
