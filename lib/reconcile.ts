import type { PhotoAnalysis, AlphaDailyPoint } from '@/lib/types';

export function reconcileSymbol(photo: PhotoAnalysis, fallback: string | null, universe: string[]): string | null {
  const candidates = [...(photo.symbol_candidates ?? [])];
  if (fallback) candidates.unshift(fallback);
  const normalized = candidates.map((sym) => sym.trim().toUpperCase());
  for (const candidate of normalized) {
    if (universe.includes(candidate)) {
      return candidate;
    }
  }
  return normalized[0] ?? null;
}

export function detectAnomalies(dailies: AlphaDailyPoint[]): string[] {
  const alerts: string[] = [];
  for (let i = 1; i < dailies.length; i += 1) {
    const prev = dailies[i - 1];
    const current = dailies[i];
    const gap = Math.abs(current.adjustedClose - prev.adjustedClose) / prev.adjustedClose;
    if (gap > 0.2) {
      alerts.push(`価格ギャップ検出: ${(gap * 100).toFixed(1)}%`);
    }
    if (current.splitCoefficient && current.splitCoefficient !== 1) {
      alerts.push(`分割イベント: ${current.splitCoefficient}`);
    }
  }
  return alerts;
}
