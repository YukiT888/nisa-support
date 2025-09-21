class AppViewsRepository {
  constructor() {
    /** @type {Map<string, { symbol: string; views: number; lastViewedAt?: string }>} */
    this.metrics = new Map();
  }

  /**
   * @param {{ symbol: string; views: number; lastViewedAt?: string }} metric
   */
  upsert(metric) {
    const existing = this.metrics.get(metric.symbol);
    if (!existing) {
      this.metrics.set(metric.symbol, { ...metric });
      return;
    }

    this.metrics.set(metric.symbol, {
      symbol: metric.symbol,
      views: metric.views ?? existing.views,
      lastViewedAt: metric.lastViewedAt ?? existing.lastViewedAt,
    });
  }

  /**
   * @param {number} limit
   */
  getMostViewed(limit) {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.views - a.views || a.symbol.localeCompare(b.symbol))
      .slice(0, limit);
  }

  /**
   * @param {Array<{ symbol: string; views: number; lastViewedAt?: string }>} metrics
   */
  load(metrics) {
    metrics.forEach((metric) => this.upsert(metric));
  }
}

export { AppViewsRepository };
