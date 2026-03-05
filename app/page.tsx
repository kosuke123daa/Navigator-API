'use client';

import { useState, FormEvent } from 'react';

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
    <main style={styles.main}>
      <div style={styles.card}>
        {/* DocuSign Navigator ロゴ風ヘッダー */}
        <div style={styles.header}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="#26a69a">
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
          </svg>
          <h1 style={styles.title}>Navigator Agreement Viewer</h1>
        </div>

        <p style={styles.description}>
          Agreement ID を入力すると、DocuSign Navigator の文書ページへリダイレクトします。
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label} htmlFor="agreementId">
            Agreement ID
          </label>
          <input
            id="agreementId"
            type="text"
            value={agreementId}
            onChange={e => setAgreementId(e.target.value)}
            placeholder="例: 48e593bd-73e8-455f-92e7-xxxxxxxxxxxx"
            style={styles.input}
            disabled={loading}
            autoFocus
            spellCheck={false}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            disabled={loading || !agreementId.trim()}
            style={{
              ...styles.button,
              opacity: loading || !agreementId.trim() ? 0.5 : 1,
              cursor: loading || !agreementId.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '取得中...' : '文書を開く →'}
          </button>
        </form>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    padding: '40px',
    width: '100%',
    maxWidth: '480px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 700,
    color: '#1a1a1a',
  },
  description: {
    margin: '0 0 28px',
    fontSize: '14px',
    color: '#666',
    lineHeight: 1.6,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#444',
  },
  input: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'monospace',
  },
  error: {
    margin: 0,
    fontSize: '13px',
    color: '#d32f2f',
    background: '#ffebee',
    border: '1px solid #ffcdd2',
    borderRadius: '6px',
    padding: '10px 12px',
  },
  button: {
    marginTop: '4px',
    padding: '13px',
    borderRadius: '8px',
    border: 'none',
    background: '#26a69a',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    transition: 'background 0.2s',
  },
};
