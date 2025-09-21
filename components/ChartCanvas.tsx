'use client';

interface Point {
  timestamp: number;
  close: number;
}

export function ChartCanvas({ series }: { series: Point[] }) {
  if (!series.length) {
    return <div className="h-40 rounded-2xl bg-white/5" />;
  }
  const values = series.map((p) => p.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = series
    .map((point, index) => {
      const x = (index / (series.length - 1 || 1)) * 100;
      const y = ((max - point.close) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" className="h-40 w-full rounded-2xl bg-white/5 p-2">
      <polyline points={points} fill="none" stroke="#6BA4FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
