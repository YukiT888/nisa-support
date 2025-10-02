import { NextResponse } from 'next/server';
import { analyzePhoto } from '@/lib/openai';
import { fetchSymbolSearch, fetchListings } from '@/lib/alphavantage';
import { reconcileSymbol } from '@/lib/reconcile';
import type { PhotoAnalysis } from '@/lib/types';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { image, hints, openAIApiKey, alphaApiKey } = await request.json();
    if (!image) {
      return NextResponse.json({ error: 'image is required' }, { status: 400 });
    }

    const photoJson: PhotoAnalysis = await analyzePhoto({ image, hints, apiKey: openAIApiKey });
    let resolved: string | null = null;
    let universe: string[] = [];

    if (alphaApiKey) {
      try {
        universe = await fetchListings(alphaApiKey);
      } catch (error) {
        console.error('Failed to load Alpha Vantage listings, continuing without universe', error);
        universe = [];
      }
    }

    if (hints?.symbolText) {
      try {
        const matches = await fetchSymbolSearch(hints.symbolText, alphaApiKey);
        resolved = matches[0]?.symbol ?? null;
      } catch (error) {
        console.error('Symbol search failed', error);
      }
    }

    if (!resolved) {
      resolved = reconcileSymbol(photoJson, hints?.symbolText ?? null, universe);
    }

    return NextResponse.json({ photo: photoJson, resolvedSymbol: resolved });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
