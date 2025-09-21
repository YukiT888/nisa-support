import { DEFAULT_THRESHOLDS } from '@/lib/constants';
import type {
  AlphaDailyPoint,
  AlphaMonthlyPoint,
  EtfProfile,
  IndicatorSet,
  OverviewProfile,
  ScoreReason,
  ScoreResult
} from '@/lib/types';

interface DecideInput {
  metrics: IndicatorSet;
  dailies: AlphaDailyPoint[];
  monthlies: AlphaMonthlyPoint[];
  mode: 'long' | 'swing';
  profile?: EtfProfile | null;
  overview?: OverviewProfile | null;
  anomalies?: string[];
}

function pushReason(list: ScoreReason[], label: string, weight: number) {
  list.push({ label, weight });
}

export function decide({ metrics, dailies, monthlies, mode, profile, overview, anomalies }: DecideInput): ScoreResult {
  if (!dailies.length || !monthlies.length || anomalies?.length) {
    return {
      decision: 'ABSTAIN',
      confidence: 0.1,
      reasons: anomalies?.map((text) => ({ label: text, weight: -1 })) ?? [],
      counters: [],
      metrics,
      horizon: mode
    };
  }

  const latest = dailies[dailies.length - 1];
  const prev = dailies[dailies.length - 2];
  const positives: ScoreReason[] = [];
  const negatives: ScoreReason[] = [];
  let score = 0;

  if (metrics.sma200 !== undefined) {
    if (latest.adjustedClose > metrics.sma200) {
      score += 2;
      pushReason(positives, `+2: 終値がSMA200(${metrics.sma200.toFixed(2)})を上回る`, 2);
    } else {
      score -= 2;
      pushReason(negatives, `-2: 終値がSMA200(${metrics.sma200.toFixed(2)})を下回る`, -2);
    }
  }

  if (metrics.sma50 !== undefined && metrics.sma200 !== undefined) {
    if (metrics.sma50 > metrics.sma200) {
      score += 2;
      pushReason(positives, '+2: SMA50がSMA200を上抜け', 2);
    } else {
      score -= 2;
      pushReason(negatives, '-2: SMA50がSMA200を下回る', -2);
    }
  }

  if (metrics.sma20 !== undefined && metrics.sma50 !== undefined) {
    if (metrics.sma20 > metrics.sma50) {
      score += 1;
      pushReason(positives, '+1: SMA20がSMA50を上回る', 1);
    } else {
      score -= 1;
      pushReason(negatives, '-1: SMA20がSMA50を下回る', -1);
    }
  }

  const rsi = metrics.rsi14;
  if (rsi !== undefined) {
    const upper = mode === 'swing' ? 65 : 70;
    if (rsi >= 45 && rsi <= 60) {
      score += 1;
      pushReason(positives, `+1: RSI14が健全圏(${rsi.toFixed(1)})`, 1);
    } else if (rsi < 35) {
      score -= 2;
      pushReason(negatives, `-2: RSI14が売られすぎ(${rsi.toFixed(1)})`, -2);
    } else if (rsi > upper) {
      score -= 2;
      pushReason(negatives, `-2: RSI14が過熱(${rsi.toFixed(1)})`, -2);
    }
  }

  if (metrics.macd !== undefined && metrics.macdSignal !== undefined) {
    if (metrics.macd > metrics.macdSignal) {
      score += 1;
      pushReason(positives, '+1: MACDがシグナルを上抜け', 1);
    } else {
      score -= 1;
      pushReason(negatives, '-1: MACDがシグナルを下回る', -1);
    }
  }

  if (metrics.atr14 !== undefined) {
    const atrRatio = (metrics.atr14 / latest.adjustedClose) * 100;
    const priceChange = ((latest.adjustedClose - prev.adjustedClose) / prev.adjustedClose) * 100;
    if (atrRatio > 5 && priceChange < 0) {
      score -= 2;
      pushReason(negatives, `-2: ボラティリティ高騰 ATR比 ${atrRatio.toFixed(1)}%`, -2);
    } else if (atrRatio < 3 && priceChange > 0) {
      score += 1;
      pushReason(positives, `+1: 安定した上昇 ATR比 ${atrRatio.toFixed(1)}%`, 1);
    }
  }

  if (metrics.volumeRatio5 !== undefined && metrics.volumeRatio20 !== undefined) {
    if (metrics.volumeRatio5 > 1.5 && latest.adjustedClose > prev.adjustedClose) {
      score += 2;
      pushReason(positives, `+2: 出来高急増 ${metrics.volumeRatio5.toFixed(2)}x`, 2);
    } else if (metrics.volumeRatio5 > 1.5 && latest.adjustedClose < prev.adjustedClose) {
      score -= 2;
      pushReason(negatives, `-2: 出来高増で下落 ${metrics.volumeRatio5.toFixed(2)}x`, -2);
    }
  }

  if (metrics.distFrom52wHigh !== undefined) {
    if (metrics.distFrom52wHigh < 10) {
      score += 1;
      pushReason(positives, `+1: 52週高値乖離 ${metrics.distFrom52wHigh.toFixed(1)}%`, 1);
    } else if (metrics.distFrom52wHigh > 25) {
      score -= 1;
      pushReason(negatives, `-1: 52週高値からの乖離 ${metrics.distFrom52wHigh.toFixed(1)}%`, -1);
    }
  }

  if (metrics.maxDrawdown !== undefined && metrics.maxDrawdown > 25) {
    score -= 1;
    pushReason(negatives, `-1: 直近最大ドローダウン ${metrics.maxDrawdown.toFixed(1)}%`, -1);
  }

  const dividend = metrics.dividendYieldTrailing ?? overview?.dividendYield;
  if (dividend !== undefined) {
    if (dividend > 3) {
      score += 1;
      pushReason(positives, `+1: 配当利回り ${dividend.toFixed(2)}%`, 1);
    }
  }

  const expense = profile?.expenseRatio;
  if (expense !== undefined) {
    if (expense > 0.6) {
      score -= 1;
      pushReason(negatives, `-1: 経費率が高い ${expense.toFixed(2)}%`, -1);
    } else if (expense < 0.2) {
      score += 1;
      pushReason(positives, `+1: 低コストETF ${expense.toFixed(2)}%`, 1);
    }
  }

  const thresholds = mode === 'long' ? DEFAULT_THRESHOLDS.long : DEFAULT_THRESHOLDS.swing;
  let decision: ScoreResult['decision'] = 'NEUTRAL';
  if (score >= thresholds.buy) {
    decision = 'BUY';
  } else if (score <= thresholds.sell) {
    decision = 'SELL';
  }

  const confidence = Math.min(0.95, Math.max(0.15, Math.abs(score) / 10 + (decision === 'NEUTRAL' ? 0.1 : 0.2)));

  return {
    decision,
    confidence,
    reasons: positives,
    counters: negatives,
    metrics,
    horizon: mode
  };
}
