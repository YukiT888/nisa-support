import { clsx } from 'clsx';

const decisionToColor: Record<string, string> = {
  BUY: 'bg-signal-buy/20 text-signal-buy border border-signal-buy/40',
  SELL: 'bg-signal-sell/20 text-signal-sell border border-signal-sell/40',
  NEUTRAL: 'bg-signal-neutral/20 text-signal-neutral border border-signal-neutral/40',
  ABSTAIN: 'bg-kachi-accent2/20 text-kachi-accent2 border border-kachi-accent2/40'
};

export function DecisionBadge({ decision }: { decision: 'BUY' | 'SELL' | 'NEUTRAL' | 'ABSTAIN' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide',
        decisionToColor[decision]
      )}
    >
      {decision}
    </span>
  );
}
