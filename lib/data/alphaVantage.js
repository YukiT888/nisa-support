import { memoizeWithTTL } from "../cache/ttlCache.js";

class AlphaVantageClient {
  /**
   * @param {{ apiKey: string; ttlMs?: number; fetcher?: typeof fetch }} options
   */
  constructor(options) {
    if (!options?.apiKey) {
      throw new Error("Alpha Vantage API key is required");
    }

    this.options = options;
    this.fetcher = options.fetcher ?? fetch;
    const ttlMs = options.ttlMs ?? 15 * 60 * 1000;
    this.getSeriesCached = memoizeWithTTL(this.fetchDailyAdjusted.bind(this), {
      ttlMs,
      getKey: (symbol) => symbol.toUpperCase(),
    });
  }

  /**
   * @param {string} symbol
   * @param {number} [lookbackDays]
   */
  async getAverageVolume(symbol, lookbackDays = 30) {
    const series = await this.getSeriesCached(symbol);
    if (!series.length) {
      return 0;
    }

    const recent = series.slice(0, lookbackDays);
    const total = recent.reduce((sum, bar) => sum + bar.volume, 0);
    return total / recent.length;
  }

  /**
   * @param {string} symbol
   * @returns {Promise<Array<{ date: string; close: number; volume: number }>>}
   */
  async fetchDailyAdjusted(symbol) {
    const params = new URLSearchParams({
      function: "TIME_SERIES_DAILY_ADJUSTED",
      symbol,
      apikey: this.options.apiKey,
      outputsize: "compact",
    });

    const response = await this.fetcher(`https://www.alphavantage.co/query?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Alpha Vantage request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const timeSeries = payload["Time Series (Daily)"];
    if (!timeSeries) {
      return [];
    }

    return Object.entries(timeSeries)
      .map(([date, bar]) => ({
        date,
        close: Number(bar["4. close"]),
        volume: Number(bar["6. volume"]),
      }))
      .filter((item) => Number.isFinite(item.volume))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }
}

export { AlphaVantageClient };
