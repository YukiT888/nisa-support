import type { AlphaDailyPoint, AlphaMonthlyPoint, IndicatorSet } from '@/lib/types';

export function sma(values: number[], period: number): number | undefined {
  if (values.length < period) return undefined;
  const slice = values.slice(-period);
  const sum = slice.reduce((acc, cur) => acc + cur, 0);
  return sum / period;
}

export function ema(values: number[], period: number): number | undefined {
  if (values.length < period) return undefined;
  const k = 2 / (period + 1);
  let emaValue = values[0];
  for (let i = 1; i < values.length; i += 1) {
    emaValue = values[i] * k + emaValue * (1 - k);
  }
  return emaValue;
}

export function rsi(data: AlphaDailyPoint[], period = 14): number | undefined {
  if (data.length <= period) return undefined;
  let gain = 0;
  let loss = 0;
  for (let i = data.length - period; i < data.length; i += 1) {
    const change = data[i].adjustedClose - data[i - 1].adjustedClose;
    if (change > 0) gain += change;
    else loss -= change;
  }
  const avgGain = gain / period;
  const avgLoss = loss / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(data: AlphaDailyPoint[], fast = 12, slow = 26, signal = 9) {
  if (data.length < slow + signal) return { macd: undefined, signal: undefined };
  const closes = data.map((d) => d.adjustedClose);
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  if (fastEma === undefined || slowEma === undefined) return { macd: undefined, signal: undefined };
  const macdValue = fastEma - slowEma;
  const macdSeries: number[] = [];
  for (let i = slow; i < closes.length; i += 1) {
    const fastSlice = ema(closes.slice(0, i + 1), fast);
    const slowSlice = ema(closes.slice(0, i + 1), slow);
    if (fastSlice !== undefined && slowSlice !== undefined) {
      macdSeries.push(fastSlice - slowSlice);
    }
  }
  const signalValue = ema(macdSeries, signal);
  return { macd: macdValue, signal: signalValue };
}

export function atr(data: AlphaDailyPoint[], period = 14): number | undefined {
  if (data.length <= period) return undefined;
  const trs: number[] = [];
  for (let i = data.length - period; i < data.length; i += 1) {
    const current = data[i];
    const prev = data[i - 1];
    const highLow = current.high - current.low;
    const highClose = Math.abs(current.high - prev.adjustedClose);
    const lowClose = Math.abs(current.low - prev.adjustedClose);
    trs.push(Math.max(highLow, highClose, lowClose));
  }
  const sum = trs.reduce((acc, cur) => acc + cur, 0);
  return sum / trs.length;
}

export function maxDrawdown(data: AlphaDailyPoint[]): number | undefined {
  if (!data.length) return undefined;
  let peak = data[0].adjustedClose;
  let maxDd = 0;
  for (const point of data) {
    if (point.adjustedClose > peak) {
      peak = point.adjustedClose;
    }
    const dd = (peak - point.adjustedClose) / peak;
    if (dd > maxDd) {
      maxDd = dd;
    }
  }
  return maxDd * 100;
}

export function distFromMA(data: AlphaDailyPoint[], period: number): number | undefined {
  const closes = data.map((d) => d.adjustedClose);
  const ma = sma(closes, period);
  if (ma === undefined) return undefined;
  const latest = closes[closes.length - 1];
  return ((latest - ma) / ma) * 100;
}

export function distFrom52wHigh(data: AlphaDailyPoint[]): number | undefined {
  if (!data.length) return undefined;
  const recent = data.slice(-252);
  const high = Math.max(...recent.map((d) => d.adjustedClose));
  const latest = recent[recent.length - 1].adjustedClose;
  return ((high - latest) / high) * 100;
}

export function volumeRatio(data: AlphaDailyPoint[], period: number): number | undefined {
  if (data.length < period) return undefined;
  const recent = data.slice(-period);
  const avg = recent.reduce((sum, item) => sum + item.volume, 0) / period;
  const latest = data[data.length - 1].volume;
  return latest / avg;
}

export function calcDividendYieldFromMonthlyAdjusted(data: AlphaMonthlyPoint[]): number | undefined {
  if (data.length < 12) return undefined;
  const recent = data.slice(-12);
  const dividends = recent.reduce((sum, item) => sum + (item.dividend ?? 0), 0);
  const latestClose = recent[recent.length - 1].adjustedClose;
  if (!latestClose) return undefined;
  return (dividends / latestClose) * 100;
}

export function buildIndicatorSet(dailies: AlphaDailyPoint[], monthlies: AlphaMonthlyPoint[]): IndicatorSet {
  const closes = dailies.map((d) => d.adjustedClose);
  return {
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    ema20: ema(closes, 20),
    rsi14: rsi(dailies),
    ...macd(dailies),
    atr14: atr(dailies),
    volumeRatio5: volumeRatio(dailies, 5),
    volumeRatio20: volumeRatio(dailies, 20),
    maxDrawdown: maxDrawdown(dailies),
    distFrom52wHigh: distFrom52wHigh(dailies),
    dividendYieldTrailing: calcDividendYieldFromMonthlyAdjusted(monthlies)
  };
}
