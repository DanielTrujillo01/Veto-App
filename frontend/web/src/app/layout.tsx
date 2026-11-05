import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteChrome } from '@/components/SiteChrome';
import './globals.css';

export const metadata: Metadata = {
  title: 'Veto',
  description: 'Encuentra y agenda servicios veterinarios, compra productos y adopta.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html data-scroll-behavior="smooth" lang="es">
      <body className="min-h-screen font-sans antialiased">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
