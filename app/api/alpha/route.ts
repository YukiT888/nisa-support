import { NextRequest, NextResponse } from 'next/server';
import { fetchDailyAdjusted, fetchMonthlyAdjusted, fetchOverview, fetchEtfProfile, fetchListings } from '@/lib/alphavantage';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const symbol = searchParams.get('symbol') ?? undefined;
  const apiKey = searchParams.get('apiKey') ?? undefined;

  try {
    switch (type) {
      case 'daily':
        if (!symbol) throw new Error('symbol is required');
        return NextResponse.json(await fetchDailyAdjusted(symbol, apiKey));
      case 'monthly':
        if (!symbol) throw new Error('symbol is required');
        return NextResponse.json(await fetchMonthlyAdjusted(symbol, apiKey));
      case 'overview':
        if (!symbol) throw new Error('symbol is required');
        return NextResponse.json(await fetchOverview(symbol, apiKey));
      case 'etf':
        if (!symbol) throw new Error('symbol is required');
        return NextResponse.json(await fetchEtfProfile(symbol, apiKey));
      case 'listings':
        return NextResponse.json(await fetchListings(apiKey));
      default:
        return NextResponse.json({ error: 'unknown type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Alpha route error', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
