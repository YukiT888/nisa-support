import { Card } from '@/components/Card';
import { DecisionBadge } from '@/components/DecisionBadge';
import { ScoreBar } from '@/components/ScoreBar';

interface StockCardProps {
  symbol: string;
  name: string;
  decision: 'BUY' | 'SELL' | 'NEUTRAL' | 'ABSTAIN';
  score: number;
  expenseRatio?: number | null;
  dividendYield?: number | null;
  onSelect?: () => void;
}

export function StockCard({
  symbol,
  name,
  decision,
  score,
  expenseRatio,
  dividendYield,
  onSelect
}: StockCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-kachi-accent"
    >
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold tracking-wide text-kachi-accent">{symbol}</p>
            <p className="text-xs text-white/70">{name}</p>
          </div>
          <DecisionBadge decision={decision} />
        </div>
        <ScoreBar value={score} />
        <div className="flex flex-wrap gap-3 text-xs text-white/80">
          {expenseRatio != null && <span>経費率: {expenseRatio.toFixed(2)}%</span>}
          {dividendYield != null && <span>配当利回り: {dividendYield.toFixed(2)}%</span>}
        </div>
      </Card>
    </button>
  );
}
