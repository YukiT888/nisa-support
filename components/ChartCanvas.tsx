'use client';

import type { PhotoAnalysis } from '@/lib/types';

interface Point {
  timestamp: number;
  close: number;
}

function transformClose(value: number, scale: 'linear' | 'log') {
  if (scale === 'log') {
    const safe = value <= 0 ? 1 : value;
    return Math.log(safe);
  }
  return value;
}

export function ChartCanvas({
  series,
  chartType = 'line',
  scale = 'linear'
}: {
  series: Point[];
  chartType?: PhotoAnalysis['chart_type'];
  scale?: 'linear' | 'log';
}) {
  if (!series.length) {
    return <div className="h-40 rounded-2xl bg-white/5" />;
  }
  const values = series.map((p) => transformClose(p.close, scale));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = series
    .map((point, index) => {
      const x = (index / (series.length - 1 || 1)) * 100;
      const y = ((max - transformClose(point.close, scale)) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  const strokeDasharray = chartType === 'candlestick' || chartType === 'bar' ? '4 2' : undefined;
  const gradientId = 'chart-gradient';
  const isArea = chartType === 'area';

  return (
    <svg viewBox="0 0 100 100" className="h-40 w-full rounded-2xl bg-white/5 p-2">
      {isArea && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(107,164,255,0.5)" />
              <stop offset="100%" stopColor="rgba(107,164,255,0)" />
            </linearGradient>
          </defs>
          <polygon
            points={`${points} 100,100 0,100`}
            fill={`url(#${gradientId})`}
            stroke="none"
            opacity={0.8}
          />
        </>
      )}
      <polyline
        points={points}
        fill="none"
        stroke="#6BA4FF"
        strokeWidth={chartType === 'candlestick' ? 1.5 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={strokeDasharray}
      />
    </svg>
  );
}
