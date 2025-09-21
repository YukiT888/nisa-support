import { NextRequest, NextResponse } from 'next/server';
import { fetchDailyAdjusted, fetchMonthlyAdjusted, fetchOverview, fetchEtfProfile, fetchListings } from '@/lib/alphavantage';
import { TTLCache } from '@/lib/cache';
import { buildIndicatorSet } from '@/lib/indicators';
import { decide } from '@/lib/scoring';
import type {
  AlphaDailyPoint,
  AlphaMonthlyPoint,
  Decision,
  IndicatorSet
} from '@/lib/types';

interface RecommendationItem {
  symbol: string;
  name: string;
  decision: Decision;
  confidence: number;
  expenseRatio: number | null;
  dividendYield: number | null;
}

interface CachedAnalysis {
  symbol: string;
  name: string;
  decision: Decision;
  confidence: number;
  expenseRatio: number | null;
  dividendYield: number | null;
  indicators: IndicatorSet;
  averageVolume: number;
  monthlyTrend1: number | null;
  monthlyTrend3: number | null;
  monthlyTrend12: number | null;
  latestClose: number;
  isEtf: boolean;
  assetClass?: string;
}

const ANALYSIS_CACHE = new TTLCache<CachedAnalysis>(30 * 60 * 1000);

function averageVolume(points: AlphaDailyPoint[], period = 20): number {
  if (!points.length) return 0;
  const slice = points.slice(-period);
  const total = slice.reduce((sum, item) => sum + item.volume, 0);
  return total / slice.length;
}

function percentageChange(points: AlphaMonthlyPoint[], monthsBack: number): number | null {
  if (points.length <= monthsBack) return null;
  const latest = points[points.length - 1]?.adjustedClose ?? 0;
  const reference = points[points.length - 1 - monthsBack]?.adjustedClose ?? 0;
  if (!latest || !reference) return null;
  return ((latest - reference) / reference) * 100;
}

function computePopularityScore(entry: CachedAnalysis): number {
  const { indicators, averageVolume: avgVolume } = entry;
  const normalizedVolume = Math.log10(Math.max(1, avgVolume));
  const relativeVolume = ((indicators.volumeRatio5 ?? 1) + (indicators.volumeRatio20 ?? 1)) / 2;

  let trendFlags = 0;
  if (indicators.sma20 !== undefined && indicators.sma50 !== undefined && indicators.sma20 > indicators.sma50) {
    trendFlags += 1;
  }
  if (indicators.sma50 !== undefined && indicators.sma200 !== undefined && indicators.sma50 > indicators.sma200) {
    trendFlags += 1;
  }
  if (indicators.sma50 !== undefined && entry.latestClose > indicators.sma50) {
    trendFlags += 1;
  }
  if (indicators.sma200 !== undefined && entry.latestClose > indicators.sma200) {
    trendFlags += 1;
  }

  const momentum1 = entry.monthlyTrend1 ?? 0;
  const momentum3 = entry.monthlyTrend3 ?? 0;
  const momentum12 = entry.monthlyTrend12 ?? 0;
  const momentumComposite = (momentum1 * 0.5 + momentum3 * 1.5 + momentum12 * 0.5) / 10;

  const distScore =
    indicators.distFrom52wHigh !== undefined ? Math.max(-1, (15 - indicators.distFrom52wHigh) / 15) : 0;
  const rsi = indicators.rsi14;
  const rsiScore = rsi !== undefined ? Math.max(-1, 1 - Math.abs(rsi - 55) / 35) : 0;

  return (
    normalizedVolume * 0.35 +
    Math.max(0, relativeVolume - 0.5) * 0.25 +
    trendFlags * 0.3 +
    momentumComposite * 0.25 +
    distScore * 0.2 +
    rsiScore * 0.15
  );
}

function computeEtfScore(entry: CachedAnalysis): number {
  const expenseRatio = entry.expenseRatio;
  const expenseScore = expenseRatio != null ? Math.max(0, 1.2 - expenseRatio) : 0.6;
  const volatility =
    entry.indicators.atr14 !== undefined && entry.latestClose
      ? (entry.indicators.atr14 / entry.latestClose) * 100
      : null;
  const volatilityScore = volatility != null ? Math.max(0, 1.5 - volatility / 4) : 0.7;
  const drawdown = entry.indicators.maxDrawdown;
  const drawdownScore = drawdown != null ? Math.max(0, 1.5 - drawdown / 35) : 0.7;
  const midTermMomentum = entry.monthlyTrend3 ?? 0;
  const longTermMomentum = entry.monthlyTrend12 ?? 0;
  const momentumScore = Math.max(0, (midTermMomentum * 0.7 + longTermMomentum * 0.3) / 12);
  return expenseScore * 0.5 + ((volatilityScore + drawdownScore) / 2) * 0.3 + momentumScore * 0.2;
}

function adjustConfidence(base: number, score: number, maxScore: number): number {
  if (!Number.isFinite(score) || maxScore <= 0) {
    return Math.min(0.95, Math.max(0.2, base));
  }
  const normalized = Math.max(0, Math.min(1, score / maxScore));
  const derived = 0.35 + normalized * 0.5;
  return Math.min(0.95, Math.max(base, derived));
}

function toRecommendationItem(entry: CachedAnalysis, confidence: number): RecommendationItem {
  return {
    symbol: entry.symbol,
    name: entry.name,
    decision: entry.decision,
    confidence,
    expenseRatio: entry.expenseRatio,
    dividendYield: entry.dividendYield
  };
}

async function analyzeSymbol(symbol: string, apiKey: string | undefined, mode: 'long' | 'swing'): Promise<CachedAnalysis | null> {
  const cacheKey = `${apiKey ?? 'default'}:${mode}:${symbol}`;
  const cached = ANALYSIS_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const [dailies, monthlies, overview, profile] = await Promise.all([
    fetchDailyAdjusted(symbol, apiKey),
    fetchMonthlyAdjusted(symbol, apiKey),
    fetchOverview(symbol, apiKey),
    fetchEtfProfile(symbol, apiKey)
  ]);

  if (!dailies.length || !monthlies.length) {
    return null;
  }

  const indicators = buildIndicatorSet(dailies, monthlies);
  const result = decide({ metrics: indicators, dailies, monthlies, mode, overview, profile });
  const avgVolume = averageVolume(dailies);
  const monthlyTrend1 = percentageChange(monthlies, 1);
  const monthlyTrend3 = percentageChange(monthlies, 3);
  const monthlyTrend12 = percentageChange(monthlies, 12);
  const latestClose = dailies[dailies.length - 1]?.adjustedClose ?? 0;
  const dividendYield = indicators.dividendYieldTrailing ?? overview?.dividendYield ?? null;

  const analysis: CachedAnalysis = {
    symbol,
    name: overview?.name ?? profile?.name ?? symbol,
    decision: result.decision,
    confidence: result.confidence,
    expenseRatio: profile?.expenseRatio ?? null,
    dividendYield,
    indicators,
    averageVolume: avgVolume,
    monthlyTrend1,
    monthlyTrend3,
    monthlyTrend12,
    latestClose,
    isEtf: profile?.expenseRatio !== undefined,
    assetClass: profile?.assetClass
  };

  ANALYSIS_CACHE.set(cacheKey, analysis);
  return analysis;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('apiKey') ?? undefined;
  const symbolsQuery = searchParams.get('symbols');
  const parsedLimit = Number.parseInt(searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 20) : 5;
  const mode = (searchParams.get('mode') as 'long' | 'swing') ?? 'long';

  if (!apiKey) {
    return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });
  }

  try {
    const listings = await fetchListings(apiKey);
    const universe = listings.map((sym) => sym.trim().toUpperCase()).filter(Boolean);

    const requestedSymbols = symbolsQuery
      ? symbolsQuery
          .split(',')
          .map((sym) => sym.trim().toUpperCase())
          .filter(Boolean)
      : [];

    const candidatePoolSize = Math.min(60, Math.max(limit * 6, 24));
    const buyScanSize = Math.min(75, Math.max(limit * 8, 30));

    const symbolPool = new Set<string>();
    for (const symbol of requestedSymbols) {
      symbolPool.add(symbol);
      if (symbolPool.size >= buyScanSize) break;
    }
    for (const symbol of universe) {
      if (symbolPool.size >= buyScanSize) break;
      symbolPool.add(symbol);
    }

    const symbolsToAnalyze = Array.from(symbolPool).slice(0, buyScanSize);
    const analyses: CachedAnalysis[] = [];

    for (const symbol of symbolsToAnalyze) {
      try {
        const analysis = await analyzeSymbol(symbol, apiKey, mode);
        if (analysis) {
          analyses.push(analysis);
        }
      } catch (error) {
        console.error('Recommend error', symbol, error);
      }
    }

    const popularityPool = analyses
      .filter((entry) => entry.averageVolume > 0)
      .slice(0, Math.min(candidatePoolSize, analyses.length));
    const popularWithScores = popularityPool.map((entry) => ({ entry, score: computePopularityScore(entry) }));
    const maxPopularScore = popularWithScores.reduce((max, item) => Math.max(max, item.score), 0);
    const popular = popularWithScores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ entry, score }) => toRecommendationItem(entry, adjustConfidence(entry.confidence, score, maxPopularScore)));

    const etfPool = analyses.filter((entry) => entry.isEtf);
    const etfWithScores = etfPool.map((entry) => ({ entry, score: computeEtfScore(entry) }));
    const maxEtfScore = etfWithScores.reduce((max, item) => Math.max(max, item.score), 0);
    const etfs = etfWithScores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ entry, score }) => toRecommendationItem(entry, adjustConfidence(entry.confidence, score, maxEtfScore)));

    const strongBuys = analyses
      .filter((entry) => entry.decision === 'BUY' && entry.confidence >= 0.6)
      .sort((a, b) => b.confidence - a.confidence);
    const supplementalBuys = analyses
      .filter((entry) => entry.decision === 'BUY' && entry.confidence < 0.6)
      .sort((a, b) => b.confidence - a.confidence);
    const combinedBuys = [...strongBuys, ...supplementalBuys].slice(0, limit);
    const buyCandidates = combinedBuys.map((entry) => toRecommendationItem(entry, entry.confidence));

    return NextResponse.json({ popular, etfs, buyCandidates });
  } catch (error) {
    console.error('Recommend route error', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
