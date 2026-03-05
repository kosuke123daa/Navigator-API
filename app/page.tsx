'use client';

import { useState, FormEvent } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  const [agreementId, setAgreementId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const id = agreementId.trim();
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/agreement?id=${encodeURIComponent(id)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
        return;
      }

      if (!data.documentUrl) {
        setError('この契約書にはドキュメントURLが含まれていません。');
        return;
      }

      window.location.href = data.documentUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-teal-600" />
            <CardTitle className="text-xl">Navigator Agreement Viewer</CardTitle>
          </div>
          <CardDescription>
            Agreement ID を入力すると、DocuSign Navigator の文書ページへリダイレクトします。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agreementId">Agreement ID</Label>
              <Input
                id="agreementId"
                value={agreementId}
                onChange={e => setAgreementId(e.target.value)}
                placeholder="例: 48e593bd-73e8-455f-92e7-xxxxxxxxxxxx"
                disabled={loading}
                autoFocus
                spellCheck={false}
                className="font-mono"
              />
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading || !agreementId.trim()} className="w-full bg-teal-600 hover:bg-teal-700">
              {loading ? '取得中...' : '文書を開く →'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
