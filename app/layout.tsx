import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Navigator Agreement Viewer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-muted font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
