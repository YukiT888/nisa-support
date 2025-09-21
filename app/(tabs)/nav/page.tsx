'use client';

import { useEffect, useState } from 'react';
import { StockCard } from '@/components/StockCard';
import { Card } from '@/components/Card';
import { useAppSettings } from '@/lib/useAppSettings';
import { DecisionBadge } from '@/components/DecisionBadge';
import { ScoreBar } from '@/components/ScoreBar';
import ja from '@/public/i18n/ja.json';

const t = ja.nav;

interface RecommendationItem {
  symbol: string;
  name: string;
  decision: 'BUY' | 'SELL' | 'NEUTRAL' | 'ABSTAIN';
  confidence: number;
  expenseRatio?: number | null;
  dividendYield?: number | null;
}

export default function NavPage() {
  const { settings, ready } = useAppSettings();
  const [data, setData] = useState<{ popular: RecommendationItem[]; etfs: RecommendationItem[]; buyCandidates: RecommendationItem[] } | null>(null);
  const [active, setActive] = useState<RecommendationItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !settings.alphaVantageApiKey) return;
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/recommend?apiKey=${encodeURIComponent(settings.alphaVantageApiKey)}&mode=${settings.mode}`, {
          signal: controller.signal
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setData(json);
        setActive(json.buyCandidates?.[0] ?? json.popular?.[0] ?? null);
      } catch (err) {
        if (!(err instanceof DOMException)) {
          setError((err as Error).message);
        }
      }
    };
    fetchData();
    return () => controller.abort();
  }, [ready, settings.alphaVantageApiKey, settings.mode]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header>
        <h2 className="text-xl font-semibold">{t.title}</h2>
        <p className="text-xs text-white/60">人気銘柄や低コストETFを自動で集計します。</p>
      </header>
      {error && <p className="text-xs text-signal-sell">{error}</p>}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-kachi-accent">{t.popular}</h3>
        <div className="grid gap-3">
          {data?.popular?.map((item) => (
            <StockCard
              key={`popular-${item.symbol}`}
              symbol={item.symbol}
              name={item.name}
              decision={item.decision}
              score={item.confidence}
              expenseRatio={item.expenseRatio ?? undefined}
              dividendYield={item.dividendYield ?? undefined}
              onSelect={() => setActive(item)}
            />
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-kachi-accent">{t.etf}</h3>
        <div className="grid gap-3">
          {data?.etfs?.map((item) => (
            <StockCard
              key={`etf-${item.symbol}`}
              symbol={item.symbol}
              name={item.name}
              decision={item.decision}
              score={item.confidence}
              expenseRatio={item.expenseRatio ?? undefined}
              dividendYield={item.dividendYield ?? undefined}
              onSelect={() => setActive(item)}
            />
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-kachi-accent">{t.buy}</h3>
        <div className="grid gap-3">
          {data?.buyCandidates?.map((item) => (
            <StockCard
              key={`buy-${item.symbol}`}
              symbol={item.symbol}
              name={item.name}
              decision={item.decision}
              score={item.confidence}
              expenseRatio={item.expenseRatio ?? undefined}
              dividendYield={item.dividendYield ?? undefined}
              onSelect={() => setActive(item)}
            />
          ))}
        </div>
      </section>
      {active && (
        <Card className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold">{active.symbol}</p>
              <p className="text-xs text-white/60">{active.name}</p>
            </div>
            <DecisionBadge decision={active.decision} />
          </div>
          <ScoreBar value={active.confidence} />
          <p className="text-xs text-white/70">勝色スコアは機械的に算出された教育用シグナルです。</p>
        </Card>
      )}
    </div>
  );
}
