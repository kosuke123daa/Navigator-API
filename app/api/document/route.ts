import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { put, head } from '@vercel/blob';

const AUTH_BASE = 'https://account-d.docusign.com';
const NAVIGATOR_BASE = 'https://api-d.docusign.com';
// All Navigator documents are stored under this prefix to avoid collisions
// with other apps using the same Vercel Blob store (e.g. mysite/).
const BLOB_PREFIX = 'navigator';

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

function extFromContentType(ct: string): string {
  if (ct.includes('pdf')) return 'pdf';
  if (ct.includes('docx') || ct.includes('wordprocessingml')) return 'docx';
  if (ct.includes('doc')) return 'doc';
  return 'bin';
}

export async function GET(request: NextRequest) {
  const agreementId = request.nextUrl.searchParams.get('id');
  if (!agreementId) {
    return NextResponse.json({ error: 'Agreement ID is required' }, { status: 400 });
  }

  try {
    const accountId = process.env.DOCUSIGN_API_ACCOUNT_ID!;
    console.log('[document] agreementId:', agreementId);

    // --- 1. Check Vercel Blob cache (try common extensions) ---
    for (const ext of ['pdf', 'docx', 'doc', 'bin']) {
      const blobPath = `${BLOB_PREFIX}/${agreementId}.${ext}`;
      try {
        const info = await head(blobPath);
        if (info?.url) {
          console.log('[document] cache hit:', blobPath);
          const cached = await fetch(info.url, { cache: 'no-store' });
          const body = await cached.arrayBuffer();
          return new NextResponse(body, {
            status: 200,
            headers: {
              'Content-Type': info.contentType ?? 'application/octet-stream',
              'Content-Disposition': 'inline',
              'X-Source': 'vercel-blob-cache',
            },
          });
        }
      } catch {
        // head() throws if not found — continue
      }
    }

    // --- 2. Fetch from DocuSign Navigator ---
    const token = await getAccessToken();

    const agreementRes = await fetch(
      `${NAVIGATOR_BASE}/v1/accounts/${accountId}/agreements/${agreementId}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    );

    if (!agreementRes.ok) {
      const body = await agreementRes.text();
      return NextResponse.json(
        { error: `Agreement fetch failed: ${agreementRes.status}`, detail: body },
        { status: agreementRes.status }
      );
    }

    const agreement = await agreementRes.json() as {
      source_name?: string;
      source_id?: string;
      _links?: { document?: { href?: string } };
    };

    // --- 3. Fetch document bytes ---
    // ESign source: use eSign API (envelope combined PDF) — avoids DMS RBAC restrictions
    // Other sources: try _links.document.href with Bearer token
    let docRes: Response;
    if (agreement.source_name === 'ESign' && agreement.source_id) {
      const envelopeId = agreement.source_id;
      const eSignUrl = `https://demo.docusign.net/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`;
      console.log('[document] fetching via eSign API:', eSignUrl);
      docRes = await fetch(eSignUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
    } else {
      const documentUrl = agreement._links?.document?.href;
      if (!documentUrl) {
        return NextResponse.json({ error: 'No document URL in agreement' }, { status: 404 });
      }
      console.log('[document] fetching via DMS link:', documentUrl);
      docRes = await fetch(documentUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
    }

    console.log('[document] DocuSign response status:', docRes.status);

    if (!docRes.ok) {
      const errBody = await docRes.text();
      console.error('[document] error body:', errBody);
      return NextResponse.json(
        { error: `Document fetch failed: ${docRes.status}`, detail: errBody },
        { status: docRes.status }
      );
    }

    const contentType = docRes.headers.get('content-type') ?? 'application/octet-stream';
    const ext = extFromContentType(contentType);
    const blobPath = `${BLOB_PREFIX}/${agreementId}.${ext}`;
    const docBuffer = await docRes.arrayBuffer();

    // --- 3. Store in Vercel Blob under navigator/ prefix ---
    await put(blobPath, docBuffer, {
      access: 'private',
      contentType,
      addRandomSuffix: false,
    });
    console.log('[document] saved to Vercel Blob:', blobPath);

    return new NextResponse(docBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'X-Source': 'docusign',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[document] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
