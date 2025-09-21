import { AlphaVantageClient } from "../data/alphaVantage.js";
import { AppViewsRepository } from "../data/appViews.js";
import { InMemoryFundamentalsRepository } from "../data/fundamentals.js";
import { rankBuyCandidates, rankEtfRecommendations, rankPopularSymbols } from "./ranking.js";

const DEFAULT_POPULAR_CRITERIA = {
  minimumAverageVolume: 150_000,
  minimumAppViews: 10,
  lookbackDays: 30,
  weights: {
    appViews: 0.7,
    averageVolume: 0.3,
  },
};

const DEFAULT_ETF_CRITERIA = {
  maxExpenseRatio: 0.01,
  minDistributionYield: 0.01,
  weights: {
    distributionYield: 0.5,
    expenseRatio: 0.3,
    averageVolume: 0.2,
  },
};

const DEFAULT_BUY_CRITERIA = {
  minBuyScore: 70,
  weights: {
    buyScore: 0.7,
    averageVolume: 0.3,
  },
};

class RecommendationService {
  /**
   * @param {{
   *  alphaVantageClient: AlphaVantageClient;
   *  appViewsRepository: AppViewsRepository;
   *  fundamentalsRepository: InMemoryFundamentalsRepository;
   *  defaults?: {
   *    popular?: Partial<typeof DEFAULT_POPULAR_CRITERIA>;
   *    etf?: Partial<typeof DEFAULT_ETF_CRITERIA>;
   *    buy?: Partial<typeof DEFAULT_BUY_CRITERIA>;
   *  };
   * }} options
   */
  constructor(options) {
    this.options = options;
    this.popularCriteria = { ...DEFAULT_POPULAR_CRITERIA, ...options.defaults?.popular };
    this.etfCriteria = { ...DEFAULT_ETF_CRITERIA, ...options.defaults?.etf };
    this.buyCriteria = { ...DEFAULT_BUY_CRITERIA, ...options.defaults?.buy };
  }

  async build(limit = 10) {
    const candidates = await this.collectCandidates(limit);

    const popular = rankPopularSymbols(candidates, this.popularCriteria).slice(0, limit);
    const etfCandidates = candidates.filter((candidate) => candidate.instrumentType === "ETF");
    const etf = rankEtfRecommendations(etfCandidates, this.etfCriteria).slice(0, limit);
    const buy = rankBuyCandidates(candidates, this.buyCriteria).slice(0, limit);
    const asOf = new Date().toISOString();

    return {
      popular: {
        criteria: this.popularCriteria,
        symbols: popular,
        asOf,
      },
      etf: {
        criteria: this.etfCriteria,
        symbols: etf,
        asOf,
      },
      buy: {
        criteria: this.buyCriteria,
        symbols: buy,
        asOf,
      },
    };
  }

  async collectCandidates(limit) {
    const mostViewed = this.options.appViewsRepository.getMostViewed(limit * 3);
    const symbols = mostViewed.map((metric) => metric.symbol);
    const fundamentals = await this.options.fundamentalsRepository.find(symbols);

    const snapshots = await Promise.all(
      fundamentals.map(async (fundamental) => {
        const averageVolume = await this.options.alphaVantageClient.getAverageVolume(
          fundamental.symbol,
          this.popularCriteria.lookbackDays
        );

        const appViews = mostViewed.find((metric) => metric.symbol === fundamental.symbol)?.views ?? 0;

        return {
          symbol: fundamental.symbol,
          name: fundamental.name,
          instrumentType: fundamental.instrumentType ?? "UNKNOWN",
          averageVolume,
          appViews,
          expenseRatio: fundamental.expenseRatio,
          distributionYield: fundamental.distributionYield,
          buyScore: fundamental.buyScore,
          price: fundamental.price,
          lastUpdated: new Date().toISOString(),
        };
      })
    );

    return snapshots;
  }
}

export {
  RecommendationService,
  DEFAULT_POPULAR_CRITERIA,
  DEFAULT_ETF_CRITERIA,
  DEFAULT_BUY_CRITERIA,
};
