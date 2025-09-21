import { NextRequest, NextResponse } from 'next/server';
import { fetchSymbolSearch } from '@/lib/alphavantage';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const apiKey = searchParams.get('apiKey') ?? undefined;
  if (!q) {
    return NextResponse.json({ error: 'q is required' }, { status: 400 });
  }
  try {
    const matches = await fetchSymbolSearch(q, apiKey);
    return NextResponse.json(matches);
  } catch (error) {
    console.error('Search route error', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
