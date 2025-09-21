'use client';

import { useMemo, useState } from 'react';
import { DecisionBadge } from '@/components/DecisionBadge';
import { ScoreBar } from '@/components/ScoreBar';
import { MetricChip } from '@/components/MetricChip';
import { Card } from '@/components/Card';
import { ChartCanvas } from '@/components/ChartCanvas';
import { useAppSettings } from '@/lib/useAppSettings';
import { DISCLAIMER } from '@/lib/constants';
import type { AdvicePayload, PhotoAnalysis, ScoreResult } from '@/lib/types';
import ja from '@/public/i18n/ja.json';

const t = ja.capture;

interface ChartPoint {
  timestamp: number;
  close: number;
}

export default function CapturePage() {
  const { settings, ready } = useAppSettings();
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [advice, setAdvice] = useState<AdvicePayload | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!preview || !ready) return;
    setLoading(true);
    setError(null);
    try {
      const analyzeRes = await fetch('/api/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: preview,
          hints: analysis ? { timeframe: analysis.timeframe } : {},
          openAIApiKey: settings.openAIApiKey,
          alphaApiKey: settings.alphaVantageApiKey
        })
      });
      if (!analyzeRes.ok) throw new Error(await analyzeRes.text());
      const analyzeJson = await analyzeRes.json();
      const resolvedSymbol = analyzeJson.resolvedSymbol as string | null;
      setAnalysis(analyzeJson.photo as PhotoAnalysis);
      setSymbol(resolvedSymbol);
      if (!resolvedSymbol) {
        throw new Error('銘柄を特定できませんでした');
      }

      const alphaKey = settings.alphaVantageApiKey ? `&apiKey=${encodeURIComponent(settings.alphaVantageApiKey)}` : '';
      const [dailyRes, monthlyRes, overviewRes, etfRes] = await Promise.all([
        fetch(`/api/alpha?type=daily&symbol=${resolvedSymbol}${alphaKey}`),
        fetch(`/api/alpha?type=monthly&symbol=${resolvedSymbol}${alphaKey}`),
        fetch(`/api/alpha?type=overview&symbol=${resolvedSymbol}${alphaKey}`),
        fetch(`/api/alpha?type=etf&symbol=${resolvedSymbol}${alphaKey}`)
      ]);

      if (!dailyRes.ok) throw new Error(await dailyRes.text());
      if (!monthlyRes.ok) throw new Error(await monthlyRes.text());

      const daily = await dailyRes.json();
      const monthly = await monthlyRes.json();
      const overview = overviewRes.ok ? await overviewRes.json() : null;
      const profile = etfRes.ok ? await etfRes.json() : null;

      const chartSeries: ChartPoint[] = (daily as any[]).slice(-120).map((point) => ({
        timestamp: new Date(point.date).getTime(),
        close: point.adjustedClose
      }));
      setChart(chartSeries);

      const scoreRes = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailies: daily,
          monthlies: monthly,
          profile,
          overview,
          mode: settings.mode
        })
      });
      if (!scoreRes.ok) throw new Error(await scoreRes.text());
      const scoreJson = (await scoreRes.json()) as ScoreResult;
      setScore(scoreJson);

      const adviceRes = await fetch('/api/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: scoreJson.decision,
          reasons: scoreJson.reasons.map((r) => r.label),
          counters: scoreJson.counters.map((r) => r.label),
          nextSteps: ['関連指数と比較する', '想定リスクと期間を再確認する'],
          openAIApiKey: settings.openAIApiKey
        })
      });
      if (adviceRes.ok) {
        setAdvice((await adviceRes.json()) as AdvicePayload);
      } else {
        setAdvice(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(() => {
    if (!score?.metrics) return [];
    return [
      score.metrics.sma20 && { label: 'SMA20', value: score.metrics.sma20.toFixed(2) },
      score.metrics.sma50 && { label: 'SMA50', value: score.metrics.sma50.toFixed(2) },
      score.metrics.sma200 && { label: 'SMA200', value: score.metrics.sma200.toFixed(2) },
      score.metrics.rsi14 && { label: 'RSI14', value: score.metrics.rsi14.toFixed(1) },
      score.metrics.dividendYieldTrailing && {
        label: '配当利回り',
        value: `${score.metrics.dividendYieldTrailing.toFixed(2)}%`
      }
    ].filter(Boolean) as { label: string; value: string }[];
  }, [score]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">{t.title}</h2>
        <p className="text-xs text-white/60">{DISCLAIMER}</p>
      </header>
      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/5 p-6 text-sm text-white/80 focus-within:ring-2 focus-within:ring-kachi-accent">
          <span>{t.upload}</span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                await handleFile(file);
              }
            }}
          />
        </label>
        {preview && (
          <img src={preview} alt="チャートプレビュー" className="w-full rounded-2xl border border-white/10" />
        )}
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!preview || loading || !ready}
          className="rounded-full bg-kachi-accent px-4 py-2 text-sm font-semibold text-kachi-shade disabled:opacity-50"
        >
          {loading ? t.analyzing : t.recalculate}
        </button>
        {error && <p className="text-xs text-signal-sell">{error}</p>}
      </div>

      {score && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{symbol}</p>
              <p className="text-xs text-white/60">モード: {score.horizon === 'long' ? '長期' : 'スイング'}</p>
            </div>
            <DecisionBadge decision={score.decision} />
          </div>
          <ScoreBar value={score.confidence} />
          <div className="flex flex-wrap gap-2">
            {metrics.map((metric) => (
              <MetricChip key={metric.label} label={metric.label} value={metric.value} />
            ))}
          </div>
          <div className="grid gap-2 text-xs">
            <div>
              <h3 className="text-white/70">根拠</h3>
              <ul className="mt-1 space-y-1">
                {score.reasons.map((reason) => (
                  <li key={reason.label}>• {reason.label}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-white/70">反対要因</h3>
              <ul className="mt-1 space-y-1">
                {score.counters.map((reason) => (
                  <li key={reason.label}>• {reason.label}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {chart.length > 0 && (
        <Card>
          <ChartCanvas series={chart} />
        </Card>
      )}

      {advice && (
        <Card className="space-y-2 text-sm">
          <h3 className="text-base font-semibold text-kachi-accent">{advice.headline}</h3>
          <div>
            <h4 className="text-xs text-white/60">ポイント</h4>
            <ul className="mt-1 space-y-1">
              {advice.rationale.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs text-white/60">留意点</h4>
            <ul className="mt-1 space-y-1">
              {advice.counterpoints.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs text-white/60">次のアクション</h4>
            <ul className="mt-1 space-y-1">
              {advice.next_steps.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
          <p className="text-[10px] text-white/50">{advice.disclaimer}</p>
        </Card>
      )}
    </div>
  );
}
