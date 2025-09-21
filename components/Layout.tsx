'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tabs } from '@/components/Tabs';
import { useEffect } from 'react';

const tabs = [
  { href: '/capture', label: '📷解析' },
  { href: '/chat', label: '💬アドバイス' },
  { href: '/nav', label: '📈銘柄ナビ' },
  { href: '/nisa', label: '🎓NISAサポート' },
  { href: '/settings', label: '⚙️設定' }
];

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .catch((error) => console.error('SW registration failed', error));
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-kachi text-kachi-textdark">
      <header className="flex items-center justify-between px-6 py-4 shadow-kachi">
        <div>
          <h1 className="text-lg font-semibold tracking-wide">NISAサポート</h1>
          <p className="text-xs text-kachi-textdark/80">投資助言ではなく教育支援を目的としています。</p>
        </div>
        <Link
          href="/settings"
          className="rounded-full border border-kachi-accent px-3 py-1 text-xs font-semibold text-kachi-accent hover:bg-kachi-tint"
        >
          API設定
        </Link>
      </header>
      <main className="flex-1 bg-kachi-tint/30 px-4 pb-24 pt-6 sm:px-6">{children}</main>
      <Tabs tabs={tabs} current={pathname} />
    </div>
  );
}
