function applyRank(symbols, scores, components) {
  return symbols.map((snapshot, index) => ({
    ...snapshot,
    rank: index + 1,
    metrics: {
      score: scores.get(snapshot.symbol) ?? 0,
      components: components.get(snapshot.symbol) ?? {},
    },
  }));
}

function scoreAndSort(snapshots, scoreFor) {
  const scores = new Map();
  const components = new Map();

  const sorted = [...snapshots]
    .map((snapshot) => {
      const result = scoreFor(snapshot);
      scores.set(snapshot.symbol, result.score);
      components.set(snapshot.symbol, result.components);
      return { snapshot, score: result.score };
    })
    .sort((a, b) => b.score - a.score || a.snapshot.symbol.localeCompare(b.snapshot.symbol))
    .map(({ snapshot }) => snapshot);

  return applyRank(sorted, scores, components);
}

function normalise(value, maxValue) {
  if (!maxValue) return 0;
  return value / maxValue;
}

function rankPopularSymbols(snapshots, criteria) {
  const eligible = snapshots.filter(
    (snapshot) =>
      (snapshot.averageVolume ?? 0) >= criteria.minimumAverageVolume &&
      (snapshot.appViews ?? 0) >= criteria.minimumAppViews
  );

  const maxViews = Math.max(0, ...eligible.map((snapshot) => snapshot.appViews ?? 0));
  const maxVolume = Math.max(0, ...eligible.map((snapshot) => snapshot.averageVolume ?? 0));

  return scoreAndSort(eligible, (snapshot) => {
    const views = snapshot.appViews ?? 0;
    const volume = snapshot.averageVolume ?? 0;
    const score =
      normalise(views, maxViews) * criteria.weights.appViews +
      normalise(volume, maxVolume) * criteria.weights.averageVolume;
    return {
      score,
      components: {
        appViews: views,
        averageVolume: volume,
      },
    };
  });
}

function rankEtfRecommendations(snapshots, criteria) {
  const eligible = snapshots.filter((snapshot) => {
    const expenseRatio = snapshot.expenseRatio ?? Number.POSITIVE_INFINITY;
    const distributionYield = snapshot.distributionYield ?? 0;
    return expenseRatio <= criteria.maxExpenseRatio && distributionYield >= criteria.minDistributionYield;
  });

  const maxDistribution = Math.max(0, ...eligible.map((snapshot) => snapshot.distributionYield ?? 0));
  const maxVolume = Math.max(0, ...eligible.map((snapshot) => snapshot.averageVolume ?? 0));

  return scoreAndSort(eligible, (snapshot) => {
    const expenseRatio = snapshot.expenseRatio ?? criteria.maxExpenseRatio;
    const distributionYield = snapshot.distributionYield ?? 0;
    const averageVolume = snapshot.averageVolume ?? 0;

    const expenseScore = 1 - Math.min(expenseRatio / criteria.maxExpenseRatio, 1);
    const distributionScore = normalise(distributionYield, maxDistribution);
    const volumeScore = normalise(averageVolume, maxVolume);

    const score =
      distributionScore * criteria.weights.distributionYield +
      expenseScore * criteria.weights.expenseRatio +
      volumeScore * criteria.weights.averageVolume;

    return {
      score,
      components: {
        distributionYield,
        expenseRatio,
        averageVolume,
      },
    };
  });
}

function rankBuyCandidates(snapshots, criteria) {
  const eligible = snapshots.filter((snapshot) => (snapshot.buyScore ?? 0) >= criteria.minBuyScore);
  const maxVolume = Math.max(0, ...eligible.map((snapshot) => snapshot.averageVolume ?? 0));
  const scoreRange = Math.max(1, 100 - criteria.minBuyScore);

  return scoreAndSort(eligible, (snapshot) => {
    const buyScore = snapshot.buyScore ?? 0;
    const averageVolume = snapshot.averageVolume ?? 0;
    const score =
      (Math.max(0, buyScore - criteria.minBuyScore) / scoreRange) * criteria.weights.buyScore +
      Math.sqrt(normalise(averageVolume, maxVolume)) * criteria.weights.averageVolume;

    return {
      score,
      components: {
        buyScore,
        averageVolume,
      },
    };
  });
}

export { rankPopularSymbols, rankEtfRecommendations, rankBuyCandidates };
