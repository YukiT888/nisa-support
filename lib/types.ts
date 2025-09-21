export type Decision = 'BUY' | 'SELL' | 'NEUTRAL' | 'ABSTAIN';

export interface ChartAnnotation {
  type: string;
  period?: number;
}

export interface ChartClaim {
  text: string;
  confidence: number;
}

export interface PhotoAnalysis {
  chart_type: 'line' | 'candlestick' | 'bar' | 'area' | 'unknown';
  x_axis: { scale: string; unit: string };
  y_axis: { scale: string; unit: string };
  symbol_candidates: string[];
  timeframe: string;
  annotations: ChartAnnotation[];
  claims: ChartClaim[];
  pitfalls: string[];
}

export interface AlphaDailyPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number;
  volume: number;
  dividend: number;
  splitCoefficient: number;
}

export interface AlphaMonthlyPoint {
  date: string;
  close: number;
  adjustedClose: number;
  dividend: number;
}

export interface EtfProfile {
  symbol: string;
  name: string;
  expenseRatio?: number;
  assetClass?: string;
}

export interface OverviewProfile {
  symbol: string;
  name: string;
  description?: string;
  sector?: string;
  industry?: string;
  dividendPerShare?: number;
  dividendYield?: number;
}

export interface IndicatorSet {
  sma20?: number;
  sma50?: number;
  sma200?: number;
  ema20?: number;
  rsi14?: number;
  macd?: number;
  macdSignal?: number;
  atr14?: number;
  volumeRatio5?: number;
  volumeRatio20?: number;
  maxDrawdown?: number;
  distFrom52wHigh?: number;
  dividendYieldTrailing?: number;
}

export interface ScoreReason {
  label: string;
  weight: number;
}

export interface ScoreResult {
  decision: Decision;
  confidence: number;
  reasons: ScoreReason[];
  counters: ScoreReason[];
  metrics: IndicatorSet;
  horizon: 'long' | 'swing';
}

export interface AdvicePayload {
  headline: string;
  rationale: string[];
  counterpoints: string[];
  next_steps: string[];
  disclaimer: string;
}

export interface AppSettings {
  openAIApiKey?: string;
  alphaVantageApiKey?: string;
  thresholds: typeof import('./constants').DEFAULT_THRESHOLDS;
  mode: 'long' | 'swing';
  theme: 'system' | 'light' | 'dark';
  acceptedDisclaimer: boolean;
}
