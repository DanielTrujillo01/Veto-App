import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Veto',
  description: 'Encuentra y agenda servicios veterinarios, compra productos y adopta.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-borde bg-superficie">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-bold text-acento">
              Veto
            </Link>
            <div className="flex gap-4 text-sm text-suave">
              <Link href="/adopcion" className="hover:text-texto">
                Adopción
              </Link>
              <Link href="/ingresar" className="hover:text-texto">
                Ingresar
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
