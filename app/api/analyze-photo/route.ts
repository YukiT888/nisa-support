import { NextResponse } from 'next/server';
import { analyzePhoto } from '@/lib/openai';
import { fetchSymbolSearch, fetchListings } from '@/lib/alphavantage';
import { reconcileSymbol } from '@/lib/reconcile';

export const runtime = 'edge';

const estimateDataUrlBytes = (value: string): number => {
  if (!value.startsWith('data:')) {
    return new TextEncoder().encode(value).length;
  }
  const base64Index = value.indexOf('base64,');
  if (base64Index === -1) {
    return new TextEncoder().encode(value).length;
  }
  const base64 = value.slice(base64Index + 'base64,'.length);
  const padding = (base64.match(/=+$/)?.[0].length ?? 0);
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

export async function POST(request: Request) {
  try {
    const { image, hints, openAIApiKey, alphaApiKey, imageMeta } = await request.json();
    if (!image) {
      return NextResponse.json({ error: 'image is required' }, { status: 400 });
    }

    const startedAt = Date.now();
    const { analysis: photoJson, responseId, usage } = await analyzePhoto({
      image,
      hints,
      apiKey: openAIApiKey
    });
    const durationMs = Date.now() - startedAt;
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

    const bytes = estimateDataUrlBytes(image);
    const kilobytes = bytes > 0 ? Math.round((bytes / 1024) * 10) / 10 : null;
    console.info('analyze-photo completed', {
      responseId,
      durationMs,
      image: {
        width: imageMeta?.width ?? null,
        height: imageMeta?.height ?? null,
        originalWidth: imageMeta?.originalWidth ?? null,
        originalHeight: imageMeta?.originalHeight ?? null,
        kilobytes
      },
      usage
    });

    return NextResponse.json({ photo: photoJson, resolvedSymbol: resolved });
  } catch (error) {
    console.error(error);
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status?: number }).status!
      : 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}
