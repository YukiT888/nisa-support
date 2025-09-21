import { NextRequest, NextResponse } from 'next/server';
import { fetchDailyAdjusted, fetchMonthlyAdjusted, fetchOverview, fetchEtfProfile, fetchListings } from '@/lib/alphavantage';
import { buildIndicatorSet } from '@/lib/indicators';
import { decide } from '@/lib/scoring';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get('apiKey') ?? undefined;
  const symbolsQuery = searchParams.get('symbols');
  const limit = Number(searchParams.get('limit') ?? '5');
  const mode = (searchParams.get('mode') as 'long' | 'swing') ?? 'long';

  if (!apiKey) {
    return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });
  }

  try {
    let symbols: string[] = [];
    if (symbolsQuery) {
      symbols = symbolsQuery.split(',').map((sym) => sym.trim().toUpperCase());
    } else {
      const listings = await fetchListings(apiKey);
      symbols = listings.slice(0, limit);
    }

    const popular: any[] = [];
    const etfs: any[] = [];
    const buyCandidates: any[] = [];

    for (const symbol of symbols) {
      try {
        const [dailies, monthlies, overview, profile] = await Promise.all([
          fetchDailyAdjusted(symbol, apiKey),
          fetchMonthlyAdjusted(symbol, apiKey),
          fetchOverview(symbol, apiKey),
          fetchEtfProfile(symbol, apiKey)
        ]);
        if (!dailies.length || !monthlies.length) continue;
        const indicators = buildIndicatorSet(dailies, monthlies);
        const result = decide({ metrics: indicators, dailies, monthlies, mode, overview, profile });
        const avgVolume = dailies.slice(-20).reduce((sum, item) => sum + item.volume, 0) / Math.min(20, dailies.length);
        const base = {
          symbol,
          name: overview?.name ?? profile?.name ?? symbol,
          decision: result.decision,
          confidence: result.confidence,
          expenseRatio: profile?.expenseRatio ?? null,
          dividendYield: indicators.dividendYieldTrailing ?? overview?.dividendYield ?? null,
          averageVolume: avgVolume
        };
        popular.push(base);
        if (profile?.expenseRatio !== undefined) {
          etfs.push(base);
        }
        if (result.decision === 'BUY') {
          buyCandidates.push(base);
        }
      } catch (error) {
        console.error('Recommend error', symbol, error);
      }
    }

    popular.sort((a, b) => (b.averageVolume ?? 0) - (a.averageVolume ?? 0));
    etfs.sort((a, b) => (a.expenseRatio ?? 999) - (b.expenseRatio ?? 999));
    buyCandidates.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

    return NextResponse.json({ popular, etfs, buyCandidates });
  } catch (error) {
    console.error('Recommend route error', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
