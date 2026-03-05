'use client';

import { useState, FormEvent } from 'react';
import { FileText, List, ChevronRight } from 'lucide-react';
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

type AgreementSummary = Pick<Agreement, 'id' | 'file_name' | 'type' | 'status' | 'parties' | 'metadata'>;

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
  // --- 一覧 ---
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [agreements, setAgreements] = useState<AgreementSummary[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchList = async (cursorId?: string) => {
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (cursorId) params.set('cursor_id', cursorId);
      const res = await fetch(`/api/agreements?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setListError(data.error ?? `Error ${res.status}`);
        return;
      }
      const items: AgreementSummary[] = data.data ?? [];
      setAgreements(prev => cursorId && prev ? [...prev, ...items] : items);
      setNextCursor(data.response_metadata?.cursor_id ?? null);
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setListLoading(false);
    }
  };

  // --- 詳細 ---
  const [agreementId, setAgreementId] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);

  const fetchDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setAgreement(null);
    try {
      const res = await fetch(`/api/agreement?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data.error ?? `Error ${res.status}`);
        return;
      }
      setAgreement(data.agreement as Agreement);
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const id = agreementId.trim();
    if (!id) return;
    fetchDetail(id);
  };

  const handleRowClick = (id: string) => {
    setAgreementId(id);
    fetchDetail(id);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const fetchDocument = () => {
    window.open(`/api/document?id=${encodeURIComponent(agreementId.trim())}`, '_blank');
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pt-12">
      <div className="w-full max-w-3xl flex flex-col gap-6">

        {/* 一覧カード */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <List className="h-6 w-6 text-teal-600" />
                <CardTitle className="text-xl">文書一覧</CardTitle>
              </div>
              <Button
                onClick={() => fetchList()}
                disabled={listLoading}
                className="bg-teal-600 hover:bg-teal-700"
                size="sm"
              >
                {listLoading && !agreements ? '取得中...' : '一覧を取得'}
              </Button>
            </div>
          </CardHeader>

          {listError && (
            <CardContent>
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {listError}
              </p>
            </CardContent>
          )}

          {agreements && (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">ファイル名</th>
                      <th className="px-4 py-2 text-left font-medium">種別</th>
                      <th className="px-4 py-2 text-left font-medium">ステータス</th>
                      <th className="px-4 py-2 text-left font-medium">当事者</th>
                      <th className="px-4 py-2 text-left font-medium">更新日時</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {agreements.map(a => (
                      <tr
                        key={a.id}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                        onClick={() => handleRowClick(a.id)}
                      >
                        <td className="px-4 py-2 max-w-[200px] truncate font-medium">{a.file_name}</td>
                        <td className="px-4 py-2 text-muted-foreground">{a.type ?? '—'}</td>
                        <td className="px-4 py-2"><StatusBadge value={a.status} /></td>
                        <td className="px-4 py-2 text-muted-foreground truncate max-w-[160px]">
                          {a.parties?.map(p => p.name_in_agreement).join(', ') || '—'}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                          {new Date(a.metadata.modified_at).toLocaleDateString('ja-JP')}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          <ChevronRight className="h-4 w-4" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {nextCursor && (
                <div className="p-4 text-center border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={listLoading}
                    onClick={() => fetchList(nextCursor)}
                  >
                    {listLoading ? '取得中...' : 'さらに読み込む'}
                  </Button>
                </div>
              )}

              <p className="px-4 py-2 text-xs text-muted-foreground border-t">
                {agreements.length} 件
              </p>
            </CardContent>
          )}
        </Card>

        {/* ID 直接検索カード */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-teal-600" />
              <CardTitle className="text-xl">ID で検索</CardTitle>
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
                  disabled={detailLoading}
                  spellCheck={false}
                  className="font-mono"
                />
              </div>
              <Button type="submit" disabled={detailLoading || !agreementId.trim()} className="bg-teal-600 hover:bg-teal-700">
                {detailLoading ? '取得中...' : '取得'}
              </Button>
            </form>

            {detailError && (
              <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {detailError}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 詳細カード */}
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
                  className="w-full bg-teal-600 hover:bg-teal-700"
                >
                  文書を表示
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </main>
  );
}
