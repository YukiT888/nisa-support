import test from "node:test";
import assert from "node:assert/strict";
import {
  rankBuyCandidates,
  rankEtfRecommendations,
  rankPopularSymbols,
} from "../../lib/recommendation/ranking.js";

const baseSnapshots = [
  {
    symbol: "AAPL",
    instrumentType: "EQUITY",
    averageVolume: 1_000_000,
    appViews: 2000,
    buyScore: 85,
  },
  {
    symbol: "MSFT",
    instrumentType: "EQUITY",
    averageVolume: 900_000,
    appViews: 1800,
    buyScore: 80,
  },
  {
    symbol: "VOO",
    instrumentType: "ETF",
    averageVolume: 1_200_000,
    appViews: 1500,
    expenseRatio: 0.0004,
    distributionYield: 0.012,
    buyScore: 78,
  },
  {
    symbol: "QQQ",
    instrumentType: "ETF",
    averageVolume: 1_100_000,
    appViews: 1400,
    expenseRatio: 0.002,
    distributionYield: 0.008,
    buyScore: 72,
  },
  {
    symbol: "SCHD",
    instrumentType: "ETF",
    averageVolume: 800_000,
    appViews: 1300,
    expenseRatio: 0.0006,
    distributionYield: 0.031,
    buyScore: 75,
  },
];

test("rankPopularSymbols prioritises views and volume", () => {
  const criteria = {
    minimumAverageVolume: 500_000,
    minimumAppViews: 1000,
    lookbackDays: 30,
    weights: {
      appViews: 0.7,
      averageVolume: 0.3,
    },
  };

  const ranked = rankPopularSymbols(baseSnapshots, criteria);
  assert.deepEqual(
    ranked.map((item) => item.symbol),
    ["AAPL", "MSFT", "VOO", "QQQ", "SCHD"]
  );
  assert.deepEqual(ranked[0].metrics.components, { appViews: 2000, averageVolume: 1_000_000 });
});

test("rankPopularSymbols filters below thresholds", () => {
  const criteria = {
    minimumAverageVolume: 500_000,
    minimumAppViews: 1000,
    lookbackDays: 30,
    weights: {
      appViews: 0.7,
      averageVolume: 0.3,
    },
  };

  const snapshots = [
    { symbol: "LOWV", instrumentType: "EQUITY", averageVolume: 100, appViews: 5 },
    { symbol: "MEETS", instrumentType: "EQUITY", averageVolume: 600_000, appViews: 1000 },
  ];
  const ranked = rankPopularSymbols(snapshots, criteria);
  assert.deepEqual(ranked.map((item) => item.symbol), ["MEETS"]);
});

test("rankEtfRecommendations sorts by yield, expense and liquidity", () => {
  const criteria = {
    maxExpenseRatio: 0.01,
    minDistributionYield: 0.01,
    weights: {
      distributionYield: 0.5,
      expenseRatio: 0.3,
      averageVolume: 0.2,
    },
  };

  const etfs = baseSnapshots.filter((snapshot) => snapshot.instrumentType === "ETF");
  const ranked = rankEtfRecommendations(etfs, criteria);
  assert.deepEqual(ranked.map((item) => item.symbol), ["SCHD", "VOO"]);
  assert.ok(Math.abs(ranked[0].metrics.components.expenseRatio - 0.0006) < 1e-6);
  assert.ok(Math.abs(ranked[0].metrics.components.distributionYield - 0.031) < 1e-6);
});

test("rankEtfRecommendations filters ETFs outside constraints", () => {
  const criteria = {
    maxExpenseRatio: 0.01,
    minDistributionYield: 0.01,
    weights: {
      distributionYield: 0.5,
      expenseRatio: 0.3,
      averageVolume: 0.2,
    },
  };

  const snapshots = [
    {
      symbol: "HIGHEXP",
      instrumentType: "ETF",
      averageVolume: 200_000,
      expenseRatio: 0.02,
      distributionYield: 0.02,
    },
    {
      symbol: "LOWYIELD",
      instrumentType: "ETF",
      averageVolume: 200_000,
      expenseRatio: 0.001,
      distributionYield: 0.005,
    },
  ];
  const ranked = rankEtfRecommendations(snapshots, criteria);
  assert.equal(ranked.length, 0);
});

test("rankBuyCandidates orders by buy score and liquidity", () => {
  const criteria = {
    minBuyScore: 75,
    weights: {
      buyScore: 0.7,
      averageVolume: 0.3,
    },
  };

  const ranked = rankBuyCandidates(baseSnapshots, criteria);
  assert.deepEqual(ranked.map((item) => item.symbol), ["AAPL", "MSFT", "VOO", "SCHD"]);
  assert.ok(ranked.every((item) => item.metrics.components.buyScore >= criteria.minBuyScore));
});

test("rankBuyCandidates filters by minimum score", () => {
  const criteria = {
    minBuyScore: 75,
    weights: {
      buyScore: 0.7,
      averageVolume: 0.3,
    },
  };

  const snapshots = [
    { symbol: "LOW", instrumentType: "EQUITY", averageVolume: 200_000, buyScore: 60 },
    { symbol: "HIGH", instrumentType: "EQUITY", averageVolume: 300_000, buyScore: 90 },
  ];
  const ranked = rankBuyCandidates(snapshots, criteria);
  assert.deepEqual(ranked.map((item) => item.symbol), ["HIGH"]);
});
