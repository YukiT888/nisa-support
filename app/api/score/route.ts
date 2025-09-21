import { NextResponse } from 'next/server';
import { buildIndicatorSet } from '@/lib/indicators';
import { decide } from '@/lib/scoring';
import { detectAnomalies } from '@/lib/reconcile';
import type { AlphaDailyPoint, AlphaMonthlyPoint, EtfProfile, OverviewProfile } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const { dailies, monthlies, profile, overview, mode, timeframeMonths, priceScale } = await request.json();
    if (!Array.isArray(dailies) || !Array.isArray(monthlies)) {
      return NextResponse.json({ error: 'series are required' }, { status: 400 });
    }
    const rawDailies = dailies as AlphaDailyPoint[];
    const monthlyPoints = monthlies as AlphaMonthlyPoint[];
    const normalizedMonths =
      typeof timeframeMonths === 'number' && Number.isFinite(timeframeMonths)
        ? Math.min(60, Math.max(1, Math.round(timeframeMonths)))
        : null;
    const normalizedScale: 'linear' | 'log' = priceScale === 'log' ? 'log' : 'linear';

    let workingDailies = rawDailies;
    if (normalizedMonths) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - normalizedMonths);
      const filtered = rawDailies.filter((point) => {
        const date = new Date(point.date);
        return !Number.isNaN(date.getTime()) && date >= cutoff;
      });
      if (filtered.length >= 10) {
        workingDailies = filtered;
      }
    }

    if (normalizedScale === 'log') {
      const filtered = workingDailies.filter((point) => point.adjustedClose > 0);
      if (filtered.length >= 10) {
        workingDailies = filtered;
      }
    }

    const indicators = buildIndicatorSet(workingDailies, monthlyPoints);
    const anomalies = detectAnomalies(workingDailies);
    const result = decide({
      metrics: indicators,
      dailies: workingDailies,
      monthlies: monthlyPoints,
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
