'use client';

import Link from 'next/link';
import { clsx } from 'clsx';

interface TabItem {
  href: string;
  label: string;
}

export function Tabs({ tabs, current }: { tabs: TabItem[]; current: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-kachi-shade/95 backdrop-blur">
      <ul className="mx-auto flex max-w-3xl justify-between px-6 py-3 text-xs font-semibold text-kachi-textdark">
        {tabs.map((tab) => {
          const active = current.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={clsx(
                  'flex min-w-[56px] flex-col items-center rounded-xl px-3 py-2 transition-colors',
                  active ? 'bg-kachi-tint text-kachi-accent shadow-kachi' : 'text-kachi-textdark/70 hover:text-kachi-accent'
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
