import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Blacker',
  description: 'Najlepsze promocje Black Week 2026 z realnym rabatem względem ceny Omnibus.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-dvh">
        <header className="border-b border-line bg-surface">
          <nav className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Blacker
            </Link>
            <Link href="/" className="text-sm text-ink-2 hover:text-ink">
              Okazje
            </Link>
            <Link href="/zrodla" className="text-sm text-ink-2 hover:text-ink">
              Źródła
            </Link>
            <span className="ml-auto hidden text-xs text-muted sm:block">Black Friday 27.11 · Cyber Monday 30.11</span>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
