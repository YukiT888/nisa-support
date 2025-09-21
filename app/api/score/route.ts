import { NextResponse } from 'next/server';
import { buildIndicatorSet } from '@/lib/indicators';
import { decide } from '@/lib/scoring';
import { detectAnomalies } from '@/lib/reconcile';
import type { AlphaDailyPoint, AlphaMonthlyPoint, EtfProfile, OverviewProfile } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const { dailies, monthlies, profile, overview, mode } = await request.json();
    if (!Array.isArray(dailies) || !Array.isArray(monthlies)) {
      return NextResponse.json({ error: 'series are required' }, { status: 400 });
    }
    const indicators = buildIndicatorSet(dailies as AlphaDailyPoint[], monthlies as AlphaMonthlyPoint[]);
    const anomalies = detectAnomalies(dailies as AlphaDailyPoint[]);
    const result = decide({
      metrics: indicators,
      dailies,
      monthlies,
      mode: mode === 'swing' ? 'swing' : 'long',
      profile: (profile ?? null) as EtfProfile | null,
      overview: (overview ?? null) as OverviewProfile | null,
      anomalies
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Score route error', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
