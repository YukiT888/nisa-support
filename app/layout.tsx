import './globals.css';
import type { Metadata } from 'next';
import { clsx } from 'clsx';
import { K2D } from 'next/font/google';
import { Layout } from '@/components/Layout';

const k2d = K2D({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-k2d'
});

export const metadata: Metadata = {
  title: 'NISAサポート',
  description: '勝色テーマのNISA教育支援PWA',
  themeColor: '#0F2540',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.svg',
    apple: '/icons/icon-512.svg'
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={clsx('bg-kachi text-kachi-textdark', k2d.variable)}>
      <body className="min-h-screen bg-kachi text-kachi-textdark">
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
