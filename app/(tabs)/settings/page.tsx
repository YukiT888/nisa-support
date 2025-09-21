'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { useAppSettings } from '@/lib/useAppSettings';
import { DEFAULT_THRESHOLDS, DISCLAIMER } from '@/lib/constants';
import type { AppSettings } from '@/lib/types';
import ja from '@/public/i18n/ja.json';

const t = ja.settings;

type Horizon = keyof typeof DEFAULT_THRESHOLDS;
type ThresholdType = keyof (typeof DEFAULT_THRESHOLDS)['long'];

export default function SettingsPage() {
  const { settings, setSettings, ready } = useAppSettings();
  const [local, setLocal] = useState<AppSettings>({
    thresholds: DEFAULT_THRESHOLDS,
    mode: 'long',
    theme: 'system',
    acceptedDisclaimer: false
  });
  const [thresholdInputs, setThresholdInputs] = useState({
    long: {
      buy: DEFAULT_THRESHOLDS.long.buy.toString(),
      sell: DEFAULT_THRESHOLDS.long.sell.toString()
    },
    swing: {
      buy: DEFAULT_THRESHOLDS.swing.buy.toString(),
      sell: DEFAULT_THRESHOLDS.swing.sell.toString()
    }
  });
  const [status, setStatus] = useState<string | null>(null);

  const clampThreshold = (value: number) => Math.max(-10, Math.min(10, value));

  const handleThresholdChange = (horizon: Horizon, thresholdType: ThresholdType) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const target = event.currentTarget;
      const rawValue = target.value;

      setThresholdInputs((prev) => ({
        ...prev,
        [horizon]: {
          ...prev[horizon],
          [thresholdType]: rawValue
        }
      }));

      if (rawValue === '' || rawValue === '-' || rawValue === '+') {
        return;
      }

      const numericValue = Number(rawValue);
      if (Number.isNaN(numericValue)) {
        return;
      }

      const clamped = clampThreshold(numericValue);
      setLocal((prev) => ({
        ...prev,
        thresholds: {
          ...prev.thresholds,
          [horizon]: {
            ...prev.thresholds[horizon],
            [thresholdType]: clamped
          }
        }
      }));

      if (clamped !== numericValue) {
        setThresholdInputs((prev) => ({
          ...prev,
          [horizon]: {
            ...prev[horizon],
            [thresholdType]: clamped.toString()
          }
        }));
      }
    };

  const handleThresholdBlur = (horizon: Horizon, thresholdType: ThresholdType) => () => {
    setThresholdInputs((prev) => {
      const current = prev[horizon][thresholdType];
      const fallback = local.thresholds[horizon][thresholdType];

      if (current === '' || current === '-' || current === '+') {
        return {
          ...prev,
          [horizon]: {
            ...prev[horizon],
            [thresholdType]: fallback.toString()
          }
        };
      }

      const numericValue = Number(current);
      if (Number.isNaN(numericValue)) {
        return {
          ...prev,
          [horizon]: {
            ...prev[horizon],
            [thresholdType]: fallback.toString()
          }
        };
      }

      const clamped = clampThreshold(numericValue);

      setLocal((prevLocal) => {
        if (prevLocal.thresholds[horizon][thresholdType] === clamped) {
          return prevLocal;
        }
        return {
          ...prevLocal,
          thresholds: {
            ...prevLocal.thresholds,
            [horizon]: {
              ...prevLocal.thresholds[horizon],
              [thresholdType]: clamped
            }
          }
        };
      });

      return {
        ...prev,
        [horizon]: {
          ...prev[horizon],
          [thresholdType]: clamped.toString()
        }
      };
    });
  };

  useEffect(() => {
    if (ready) {
      setLocal(settings);
      setThresholdInputs({
        long: {
          buy: settings.thresholds.long.buy.toString(),
          sell: settings.thresholds.long.sell.toString()
        },
        swing: {
          buy: settings.thresholds.swing.buy.toString(),
          sell: settings.thresholds.swing.sell.toString()
        }
      });
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
          <h3 className="text-base font-semibold text-kachi-accent">{t.thresholds.title}</h3>
          <p className="text-xs text-white/60">{t.thresholds.description}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-white/60">{t.thresholds.longBuy}</span>
              <input
                type="number"
                inputMode="decimal"
                min={-10}
                max={10}
                step={0.1}
                value={thresholdInputs.long.buy}
                onChange={handleThresholdChange('long', 'buy')}
                onBlur={handleThresholdBlur('long', 'buy')}
                className="rounded-xl border border-white/10 bg-white/10 p-2 text-sm text-white focus:border-kachi-accent focus:outline-none focus:ring-2 focus:ring-kachi-accent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-white/60">{t.thresholds.longSell}</span>
              <input
                type="number"
                inputMode="decimal"
                min={-10}
                max={10}
                step={0.1}
                value={thresholdInputs.long.sell}
                onChange={handleThresholdChange('long', 'sell')}
                onBlur={handleThresholdBlur('long', 'sell')}
                className="rounded-xl border border-white/10 bg-white/10 p-2 text-sm text-white focus:border-kachi-accent focus:outline-none focus:ring-2 focus:ring-kachi-accent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-white/60">{t.thresholds.swingBuy}</span>
              <input
                type="number"
                inputMode="decimal"
                min={-10}
                max={10}
                step={0.1}
                value={thresholdInputs.swing.buy}
                onChange={handleThresholdChange('swing', 'buy')}
                onBlur={handleThresholdBlur('swing', 'buy')}
                className="rounded-xl border border-white/10 bg-white/10 p-2 text-sm text-white focus:border-kachi-accent focus:outline-none focus:ring-2 focus:ring-kachi-accent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-white/60">{t.thresholds.swingSell}</span>
              <input
                type="number"
                inputMode="decimal"
                min={-10}
                max={10}
                step={0.1}
                value={thresholdInputs.swing.sell}
                onChange={handleThresholdChange('swing', 'sell')}
                onBlur={handleThresholdBlur('swing', 'sell')}
                className="rounded-xl border border-white/10 bg-white/10 p-2 text-sm text-white focus:border-kachi-accent focus:outline-none focus:ring-2 focus:ring-kachi-accent"
              />
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
