import { unstable_noStore as noStore } from 'next/cache';
import { TTLCache } from '@/lib/cache';
import type {
  AlphaDailyPoint,
  AlphaMonthlyPoint,
  EtfProfile,
  OverviewProfile
} from '@/lib/types';

const BASE_URL = 'https://www.alphavantage.co/query';
const cache = new TTLCache<any>(15 * 60 * 1000);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestAlpha(endpoint: string, params: Record<string, string>, apiKey?: string, attempt = 0): Promise<any> {
  noStore();
  const key = apiKey ?? process.env.ALPHAVANTAGE_API_KEY;
  if (!key) throw new Error('Alpha Vantage APIキーが設定されていません');
  const searchParams = new URLSearchParams({ function: endpoint, apikey: key, ...params });
  const url = `${BASE_URL}?${searchParams.toString()}`;
  const cached = cache.get(url);
  if (cached) return cached;

  const response = await fetch(url, { cache: 'no-store' });
  if (response.status === 429 && attempt < 5) {
    const retryAfter = Number(response.headers.get('retry-after')) || 2 ** attempt;
    await sleep(retryAfter * 1000);
    return requestAlpha(endpoint, params, apiKey, attempt + 1);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Alpha Vantageエラー: ${response.status} ${text}`);
  }
  const contentType = response.headers.get('content-type');
  const data = contentType?.includes('csv') ? await response.text() : await response.json();
  cache.set(url, data);
  return data;
}

function parseDaily(json: any): AlphaDailyPoint[] {
  const timeSeries = json['Time Series (Daily)'];
  if (!timeSeries) return [];
  return Object.entries(timeSeries).map(([date, value]: [string, any]) => ({
    date,
    open: Number(value['1. open']),
    high: Number(value['2. high']),
    low: Number(value['3. low']),
    close: Number(value['4. close']),
    adjustedClose: Number(value['5. adjusted close']),
    volume: Number(value['6. volume']),
    dividend: Number(value['7. dividend amount']),
    splitCoefficient: Number(value['8. split coefficient'])
  }));
}

function parseMonthly(json: any): AlphaMonthlyPoint[] {
  const series = json['Monthly Adjusted Time Series'];
  if (!series) return [];
  return Object.entries(series).map(([date, value]: [string, any]) => ({
    date,
    close: Number(value['4. close']),
    adjustedClose: Number(value['5. adjusted close']),
    dividend: Number(value['7. dividend amount'])
  }));
}

export async function fetchDailyAdjusted(symbol: string, apiKey?: string): Promise<AlphaDailyPoint[]> {
  const data = await requestAlpha('TIME_SERIES_DAILY_ADJUSTED', { symbol, outputsize: 'full' }, apiKey);
  return parseDaily(data).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function fetchMonthlyAdjusted(symbol: string, apiKey?: string): Promise<AlphaMonthlyPoint[]> {
  const data = await requestAlpha('TIME_SERIES_MONTHLY_ADJUSTED', { symbol }, apiKey);
  return parseMonthly(data).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function fetchOverview(symbol: string, apiKey?: string): Promise<OverviewProfile | null> {
  const data = await requestAlpha('OVERVIEW', { symbol }, apiKey);
  if (!data || !data.Symbol) return null;
  return {
    symbol: data.Symbol,
    name: data.Name,
    description: data.Description,
    sector: data.Sector,
    industry: data.Industry,
    dividendPerShare: data.DividendPerShare ? Number(data.DividendPerShare) : undefined,
    dividendYield: data.DividendYield ? Number(data.DividendYield) * 100 : undefined
  };
}

export async function fetchEtfProfile(symbol: string, apiKey?: string): Promise<EtfProfile | null> {
  const data = await requestAlpha('ETF_PROFILE', { symbol }, apiKey);
  if (!data || !Array.isArray(data.data) || data.data.length === 0) return null;
  const entry = data.data[0];
  return {
    symbol: entry.ticker,
    name: entry.name,
    expenseRatio: entry.expenseRatio ? Number(entry.expenseRatio) : undefined,
    assetClass: entry.assetClass
  };
}

export async function fetchSymbolSearch(keyword: string, apiKey?: string) {
  const data = await requestAlpha('SYMBOL_SEARCH', { keywords: keyword }, apiKey);
  const matches = data.bestMatches ?? [];
  return matches.map((match: any) => ({
    symbol: match['1. symbol'],
    name: match['2. name'],
    region: match['4. region']
  }));
}

export async function fetchListings(apiKey?: string): Promise<string[]> {
  const csv = await requestAlpha('LISTING_STATUS', { state: 'active' }, apiKey);
  if (typeof csv !== 'string') return [];
  const lines = csv.trim().split('\n');
  return lines.slice(1).map((line) => line.split(',')[0]);
}
