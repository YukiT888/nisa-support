'use client';

import { useMemo, useState } from 'react';
import { DecisionBadge } from '@/components/DecisionBadge';
import { ScoreBar } from '@/components/ScoreBar';
import { MetricChip } from '@/components/MetricChip';
import { Card } from '@/components/Card';
import { ChartCanvas } from '@/components/ChartCanvas';
import { useAppSettings } from '@/lib/useAppSettings';
import { DISCLAIMER } from '@/lib/constants';
import type {
  AdvicePayload,
  AlphaDailyPoint,
  AlphaMonthlyPoint,
  PhotoAnalysis,
  ScoreResult
} from '@/lib/types';
import { processImageFile } from '@/lib/imageProcessing';
import ja from '@/public/i18n/ja.json';

const t = ja.capture;

const TIMEFRAME_MIN = 1;
const TIMEFRAME_MAX = 36;

function clampTimeframe(value: number) {
  if (!Number.isFinite(value)) return TIMEFRAME_MIN;
  return Math.min(TIMEFRAME_MAX, Math.max(TIMEFRAME_MIN, Math.round(value)));
}

function deriveMonthsFromAnalysisTimeframe(timeframe?: string | null) {
  if (!timeframe) return null;
  const normalized = timeframe.trim();
  if (!normalized) return null;
  const directMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(d|day|days|w|week|weeks|m|month|months|y|yr|year|years)/i);
  const compactMatch = normalized.match(/(\d+(?:\.\d+)?)([dwmy])/i);
  const match = directMatch ?? compactMatch;
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = (match[2] ?? '').toLowerCase();
  let months = value;
  if (unit.startsWith('d')) {
    months = value / 30;
  } else if (unit.startsWith('w')) {
    months = (value * 7) / 30;
  } else if (unit.startsWith('y')) {
    months = value * 12;
  }
  return clampTimeframe(months);
}

function deriveScaleFromAnalysisScale(scale?: string | null): 'linear' | 'log' | null {
  if (!scale) return null;
  return scale.toLowerCase().includes('log') ? 'log' : 'linear';
}

function filterDailiesByMonths(dailies: AlphaDailyPoint[], months: number) {
  const monthsClamped = clampTimeframe(months);
  const start = new Date();
  start.setMonth(start.getMonth() - monthsClamped);
  const filtered = dailies.filter((point) => {
    const date = new Date(point.date);
    return !Number.isNaN(date.getTime()) && date >= start;
  });
  return filtered.length >= 10 ? filtered : dailies;
}

function formatChartTypeLabel(type: PhotoAnalysis['chart_type']) {
  switch (type) {
    case 'line':
      return 'ラインチャート';
    case 'area':
      return 'エリアチャート';
    case 'candlestick':
      return 'ローソク足';
    case 'bar':
      return 'バーチャート';
    default:
      return '不明なチャート';
  }
}

interface ChartPoint {
  timestamp: number;
  close: number;
}

export default function CapturePage() {
  const { settings, ready } = useAppSettings();
  const [preview, setPreview] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
  } | null>(null);
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [advice, setAdvice] = useState<AdvicePayload | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState<string | null>(null);
  const [timeframeMonths, setTimeframeMonths] = useState(() => clampTimeframe(6));
  const [priceScale, setPriceScale] = useState<'linear' | 'log'>('linear');
  const [analysisTimeframe, setAnalysisTimeframe] = useState<number | null>(null);
  const [analysisScale, setAnalysisScale] = useState<'linear' | 'log' | null>(null);
  const [paramsDirty, setParamsDirty] = useState(false);

  const syncDirty = (
    nextMonths: number,
    nextScale: 'linear' | 'log',
    baseMonths?: number | null,
    baseScale?: 'linear' | 'log' | null
  ) => {
    const fallbackMonths = baseMonths ?? analysisTimeframe ?? clampTimeframe(6);
    const fallbackScale = baseScale ?? analysisScale ?? 'linear';
    setParamsDirty(nextMonths !== fallbackMonths || nextScale !== fallbackScale);
  };

  const handleFile = async (file: File) => {
    try {
      setError(null);
      setPreview(null);
      setAnalysis(null);
      setScore(null);
      setAdvice(null);
      setChart([]);
      setSymbol(null);
      setPreviewMeta(null);
      const defaultMonths = clampTimeframe(6);
      setTimeframeMonths(defaultMonths);
      setPriceScale('linear');
      setAnalysisTimeframe(null);
      setAnalysisScale(null);
      syncDirty(defaultMonths, 'linear', defaultMonths, 'linear');

      const processed = await processImageFile(file);
      setPreview(processed.dataUrl);
      setPreviewMeta({
        width: processed.width,
        height: processed.height,
        originalWidth: processed.originalWidth,
        originalHeight: processed.originalHeight
      });
    } catch (err) {
      console.error(err);
      setError('画像の処理中に問題が発生しました');
      setPreviewMeta(null);
    }
  };

  const handleAnalyze = async () => {
    if (!preview || !ready) return;
    const clamped = clampTimeframe(timeframeMonths);
    setTimeframeMonths(clamped);
    setLoading(true);
    setError(null);
    try {
      const analyzeRes = await fetch('/api/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: preview,
          imageMeta: previewMeta ?? undefined,
          hints: analysis ? { timeframe: analysis.timeframe } : {},
          openAIApiKey: settings.openAIApiKey,
          alphaApiKey: settings.alphaVantageApiKey
        })
      });
      if (!analyzeRes.ok) throw new Error(await analyzeRes.text());
      const analyzeJson = await analyzeRes.json();
      const resolvedSymbol = analyzeJson.resolvedSymbol as string | null;
      const nextAnalysis = analyzeJson.photo as PhotoAnalysis;
      setAnalysis(nextAnalysis);
      setSymbol(resolvedSymbol);
      if (!resolvedSymbol) {
        throw new Error('銘柄を特定できませんでした');
      }

      const derivedTimeframe = deriveMonthsFromAnalysisTimeframe(nextAnalysis.timeframe) ?? clamped;
      const derivedScale = deriveScaleFromAnalysisScale(nextAnalysis.x_axis?.scale) ?? priceScale;
      setAnalysisTimeframe(derivedTimeframe);
      setAnalysisScale(derivedScale);
      setTimeframeMonths(derivedTimeframe);
      setPriceScale(derivedScale);
      syncDirty(derivedTimeframe, derivedScale, derivedTimeframe, derivedScale);

      const alphaKey = settings.alphaVantageApiKey ? `&apiKey=${encodeURIComponent(settings.alphaVantageApiKey)}` : '';
      const [dailyRes, monthlyRes, overviewRes, etfRes] = await Promise.all([
        fetch(`/api/alpha?type=daily&symbol=${resolvedSymbol}${alphaKey}`),
        fetch(`/api/alpha?type=monthly&symbol=${resolvedSymbol}${alphaKey}`),
        fetch(`/api/alpha?type=overview&symbol=${resolvedSymbol}${alphaKey}`),
        fetch(`/api/alpha?type=etf&symbol=${resolvedSymbol}${alphaKey}`)
      ]);

      if (!dailyRes.ok) throw new Error(await dailyRes.text());
      if (!monthlyRes.ok) throw new Error(await monthlyRes.text());

      const daily = (await dailyRes.json()) as AlphaDailyPoint[];
      const monthly = (await monthlyRes.json()) as AlphaMonthlyPoint[];
      const overview = overviewRes.ok ? await overviewRes.json() : null;
      const profile = etfRes.ok ? await etfRes.json() : null;

      const filteredDaily = filterDailiesByMonths(daily, derivedTimeframe);
      const sortedDaily = [...filteredDaily].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const chartSeries: ChartPoint[] = sortedDaily.map((point) => ({
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
          mode: settings.mode,
          timeframeMonths: derivedTimeframe,
          priceScale: derivedScale
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
        {loading && <p className="text-xs text-white/60">画像解析とスコアを再計算しています…</p>}
        {error && <p className="text-xs text-signal-sell">{error}</p>}
      </div>

      <Card className="space-y-4 text-sm">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-kachi-accent">再計算パラメータ</h3>
          <span className="text-[10px] text-white/50">
            {analysis
              ? paramsDirty
                ? '解析結果からカスタマイズされています'
                : `解析推奨: ${analysis.timeframe} / ${analysis.x_axis.scale}`
              : '解析後に推奨値が設定されます'}
          </span>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>表示期間</span>
            <span>{timeframeMonths}ヶ月</span>
          </div>
          <input
            type="range"
            min={TIMEFRAME_MIN}
            max={TIMEFRAME_MAX}
            value={timeframeMonths}
            disabled={loading}
            onChange={(event) => {
              const value = clampTimeframe(Number(event.target.value));
              setTimeframeMonths(value);
              syncDirty(value, priceScale);
            }}
            className="mt-2 w-full cursor-pointer accent-kachi-accent disabled:cursor-not-allowed"
          />
        </div>
        <div className="space-y-2">
          <span className="text-xs text-white/60">価格スケール</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                const nextScale: 'linear' | 'log' = 'linear';
                setPriceScale(nextScale);
                syncDirty(timeframeMonths, nextScale);
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-kachi-accent ${
                priceScale === 'linear'
                  ? 'bg-kachi-accent text-kachi-shade shadow'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              } ${loading ? 'cursor-not-allowed opacity-60 hover:bg-white/10' : ''}`}
            >
              リニア
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                const nextScale: 'linear' | 'log' = 'log';
                setPriceScale(nextScale);
                syncDirty(timeframeMonths, nextScale);
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-kachi-accent ${
                priceScale === 'log'
                  ? 'bg-kachi-accent text-kachi-shade shadow'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              } ${loading ? 'cursor-not-allowed opacity-60 hover:bg-white/10' : ''}`}
            >
              対数
            </button>
          </div>
        </div>
        {analysis && paramsDirty && (
          <p className="text-[10px] text-white/50">解析結果と異なる設定で再計算します。</p>
        )}
      </Card>

      {score && (
        <Card className={`space-y-4 ${loading ? 'opacity-70' : ''}`}>
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
          {loading && <p className="text-[10px] text-white/50">スコアを更新しています…</p>}
        </Card>
      )}

      {chart.length > 0 && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>
              {analysis
                ? `${formatChartTypeLabel(analysis.chart_type)} (${analysis.timeframe})`
                : 'チャート'}
            </span>
            <span>スケール: {priceScale === 'log' ? '対数' : 'リニア'}</span>
          </div>
          <ChartCanvas series={chart} chartType={analysis?.chart_type} scale={priceScale} />
          {loading && <p className="text-[10px] text-white/50">チャートを更新中…</p>}
        </Card>
      )}

      {analysis && (
        <Card className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2 text-xs text-white/80">
            <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white">
              {formatChartTypeLabel(analysis.chart_type)}
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-white/70">
              推定タイムフレーム: {analysis.timeframe || '---'}
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-white/70">
              軸スケール: X {analysis.x_axis.scale} / Y {analysis.y_axis.scale}
            </span>
          </div>
          <div>
            <h3 className="text-xs text-white/60">注釈</h3>
            {analysis.annotations.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {analysis.annotations.map((item, index) => (
                  <li
                    key={`${item.type}-${index}`}
                    className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80"
                  >
                    {item.type}
                    {item.period ? ` (${item.period})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-white/50">検出された注釈はありません。</p>
            )}
          </div>
          <div className="grid gap-3 text-[11px] sm:grid-cols-2">
            <div>
              <h3 className="text-xs text-white/60">Claims</h3>
              {analysis.claims.length ? (
                <ul className="mt-1 space-y-1 text-white/80">
                  {analysis.claims.map((claim, index) => {
                    const normalized = claim.confidence <= 1 ? claim.confidence * 100 : claim.confidence;
                    const confidence = `${Math.round(Math.max(0, Math.min(normalized, 100)))}%`;
                    return (
                      <li key={`${claim.text}-${index}`}>
                        • {claim.text}{' '}
                        <span className="text-white/50">({confidence})</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-white/50">主張は抽出されませんでした。</p>
              )}
            </div>
            <div>
              <h3 className="text-xs text-white/60">Pitfalls</h3>
              {analysis.pitfalls.length ? (
                <ul className="mt-1 space-y-1 text-white/80">
                  {analysis.pitfalls.map((item, index) => (
                    <li key={`${item}-${index}`}>• {item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-white/50">特筆すべき注意点はありません。</p>
              )}
            </div>
          </div>
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
