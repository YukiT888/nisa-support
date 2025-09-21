class InMemoryFundamentalsRepository {
  /**
   * @param {Array<{ symbol: string; name?: string; instrumentType: "EQUITY" | "ETF" | "FUND" | "UNKNOWN"; expenseRatio?: number; distributionYield?: number; buyScore?: number; price?: number }>} [initial]
   */
  constructor(initial = []) {
    /** @type {Map<string, any>} */
    this.records = new Map();
    initial.forEach((record) => this.records.set(record.symbol, record));
  }

  /**
   * @param {string[]} symbols
   */
  async find(symbols) {
    return symbols
      .map((symbol) => this.records.get(symbol))
      .filter((record) => Boolean(record));
  }

  /**
   * @param {{ symbol: string; name?: string; instrumentType: "EQUITY" | "ETF" | "FUND" | "UNKNOWN"; expenseRatio?: number; distributionYield?: number; buyScore?: number; price?: number }} record
   */
  upsert(record) {
    this.records.set(record.symbol, record);
  }
}

export { InMemoryFundamentalsRepository };
