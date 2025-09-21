'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { useAppSettings } from '@/lib/useAppSettings';
import { DEFAULT_THRESHOLDS, DISCLAIMER } from '@/lib/constants';
import type { AppSettings } from '@/lib/types';
import ja from '@/public/i18n/ja.json';

const t = ja.settings;

export default function SettingsPage() {
  const { settings, setSettings, ready } = useAppSettings();
  const [local, setLocal] = useState<AppSettings>({
    thresholds: DEFAULT_THRESHOLDS,
    mode: 'long',
    theme: 'system',
    acceptedDisclaimer: false
  });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (ready) {
      setLocal(settings);
    }
  }, [ready, settings]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await setSettings(local);
    setStatus('保存しました');
    setTimeout(() => setStatus(null), 3000);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header>
        <h2 className="text-xl font-semibold">{t.title}</h2>
        <p className="text-xs text-white/60">{DISCLAIMER}</p>
      </header>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card className="space-y-3 text-sm">
          <h3 className="text-base font-semibold text-kachi-accent">APIキー</h3>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-white/60">{t.openai}</span>
            <input
              type="password"
              value={local.openAIApiKey ?? ''}
              onChange={(event) => setLocal((prev) => ({ ...prev, openAIApiKey: event.target.value }))}
              className="rounded-xl border border-white/10 bg-white/10 p-2 text-sm text-white focus:border-kachi-accent focus:outline-none focus:ring-2 focus:ring-kachi-accent"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-white/60">{t.alpha}</span>
            <input
              type="password"
              value={local.alphaVantageApiKey ?? ''}
              onChange={(event) => setLocal((prev) => ({ ...prev, alphaVantageApiKey: event.target.value }))}
              className="rounded-xl border border-white/10 bg-white/10 p-2 text-sm text-white focus:border-kachi-accent focus:outline-none focus:ring-2 focus:ring-kachi-accent"
            />
          </label>
        </Card>
        <Card className="space-y-3 text-sm">
          <h3 className="text-base font-semibold text-kachi-accent">{t.mode}</h3>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="mode"
                value="long"
                checked={local.mode === 'long'}
                onChange={() => setLocal((prev) => ({ ...prev, mode: 'long' }))}
              />
              {t.long}
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="mode"
                value="swing"
                checked={local.mode === 'swing'}
                onChange={() => setLocal((prev) => ({ ...prev, mode: 'swing' }))}
              />
              {t.swing}
            </label>
          </div>
        </Card>
        <Card className="space-y-3 text-sm">
          <h3 className="text-base font-semibold text-kachi-accent">{t.theme}</h3>
          <select
            value={local.theme}
            onChange={(event) => setLocal((prev) => ({ ...prev, theme: event.target.value as AppSettings['theme'] }))}
            className="rounded-xl border border-white/10 bg-white/10 p-2 text-sm text-white focus:border-kachi-accent focus:outline-none focus:ring-2 focus:ring-kachi-accent"
          >
            <option value="system">システム</option>
            <option value="light">ライト</option>
            <option value="dark">ダーク</option>
          </select>
        </Card>
        <Card className="space-y-3 text-sm">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={local.acceptedDisclaimer}
              onChange={(event) => setLocal((prev) => ({ ...prev, acceptedDisclaimer: event.target.checked }))}
            />
            {t.disclaimer}
          </label>
        </Card>
        <button
          type="submit"
          className="rounded-full bg-kachi-accent px-4 py-2 text-sm font-semibold text-kachi-shade disabled:opacity-50"
          disabled={!local.acceptedDisclaimer}
        >
          {t.save}
        </button>
        {status && <p className="text-xs text-kachi-accent">{status}</p>}
      </form>
    </div>
  );
}
