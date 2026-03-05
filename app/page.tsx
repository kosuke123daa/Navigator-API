'use client';

import { useState, FormEvent } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Party = { id: string; name_in_agreement: string };
type Agreement = {
  id: string;
  file_name: string;
  document_id: string;
  type: string;
  category: string;
  status: string;
  review_status: string;
  parties: Party[];
  provisions: Record<string, unknown>;
  custom_provisions: Record<string, unknown>;
  languages: string[];
  source_name: string;
  source_id: string;
  metadata: {
    created_at: string;
    modified_at: string;
    created_by: string;
    modified_by: string;
  };
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-1.5 border-b last:border-0">
      <span className="w-36 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-sm break-all">{value}</span>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    COMPLETE: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    ACTIVE: 'bg-blue-100 text-blue-700',
  };
  const cls = colors[value] ?? 'bg-gray-100 text-gray-700';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{value}</span>;
}

export default function Home() {
  const [agreementId, setAgreementId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const fetchDocument = async () => {
    setDocLoading(true);
    setDocError(null);
    if (docUrl) URL.revokeObjectURL(docUrl);
    setDocUrl(null);
    try {
      const res = await fetch(`/api/document?id=${encodeURIComponent(agreementId.trim())}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDocError(data.error ?? `Error ${res.status}`);
        return;
      }
      const blob = await res.blob();
      setDocUrl(URL.createObjectURL(blob));
    } catch (err: unknown) {
      setDocError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setDocLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const id = agreementId.trim();
    if (!id) return;

    setLoading(true);
    setError(null);
    setAgreement(null);
    setDocUrl(null);
    setDocError(null);

    try {
      const res = await fetch(`/api/agreement?id=${encodeURIComponent(id)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
        return;
      }

      setAgreement(data.agreement as Agreement);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pt-12">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-teal-600" />
              <CardTitle className="text-xl">Navigator Agreement Viewer</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="agreementId" className="sr-only">Agreement ID</Label>
                <Input
                  id="agreementId"
                  value={agreementId}
                  onChange={e => setAgreementId(e.target.value)}
                  placeholder="Agreement ID を入力"
                  disabled={loading}
                  autoFocus
                  spellCheck={false}
                  className="font-mono"
                />
              </div>
              <Button type="submit" disabled={loading || !agreementId.trim()} className="bg-teal-600 hover:bg-teal-700">
                {loading ? '取得中...' : '取得'}
              </Button>
            </form>

            {error && (
              <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </CardContent>
        </Card>

        {agreement && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{agreement.file_name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">基本情報</h3>
                <Row label="Agreement ID" value={<span className="font-mono text-xs">{agreement.id}</span>} />
                <Row label="種別" value={agreement.type} />
                <Row label="カテゴリ" value={agreement.category} />
                <Row label="言語" value={agreement.languages.join(', ')} />
                <Row label="ソース" value={agreement.source_name} />
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">ステータス</h3>
                <Row label="契約ステータス" value={<StatusBadge value={agreement.status} />} />
                <Row label="レビューステータス" value={<StatusBadge value={agreement.review_status} />} />
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">当事者</h3>
                {agreement.parties.map((p, i) => (
                  <Row key={p.id} label={`当事者 ${i + 1}`} value={p.name_in_agreement} />
                ))}
              </section>

              {(Object.keys(agreement.provisions).length > 0 || Object.keys(agreement.custom_provisions).length > 0) && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">条項</h3>
                  {Object.entries(agreement.provisions).map(([k, v]) => (
                    <Row key={k} label={k} value={String(v)} />
                  ))}
                  {Object.entries(agreement.custom_provisions).map(([k, v]) => (
                    <Row key={k} label={k} value={String(v)} />
                  ))}
                </section>
              )}

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">メタデータ</h3>
                <Row label="作成日時" value={new Date(agreement.metadata.created_at).toLocaleString('ja-JP')} />
                <Row label="更新日時" value={new Date(agreement.metadata.modified_at).toLocaleString('ja-JP')} />
              </section>

              <div className="pt-2">
                <Button
                  type="button"
                  onClick={fetchDocument}
                  disabled={docLoading}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                >
                  {docLoading ? '文書取得中...' : '文書を表示 (BLOB)'}
                </Button>
                {docError && (
                  <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {docError}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {docUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">文書プレビュー</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden rounded-b-lg">
              <iframe
                src={docUrl}
                className="w-full border-0"
                style={{ height: '80vh' }}
                title="Agreement Document"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
