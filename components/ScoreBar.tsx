export function ScoreBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span>信頼度</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-white/10">
        <div
          className="h-2 rounded-full bg-kachi-accent transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}
