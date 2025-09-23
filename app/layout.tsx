import './globals.css';
import type { Metadata } from 'next';
import { Layout } from '@/components/Layout';

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
    <html lang="ja" className="bg-kachi text-kachi-textdark">
      <body className="min-h-screen bg-kachi text-kachi-textdark">
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
