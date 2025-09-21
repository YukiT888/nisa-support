import { AlphaVantageClient } from "../../../lib/data/alphaVantage.js";
import { AppViewsRepository } from "../../../lib/data/appViews.js";
import { InMemoryFundamentalsRepository } from "../../../lib/data/fundamentals.js";
import { RecommendationService } from "../../../lib/recommendation/service.js";

function buildFundamentalsRepository(): InMemoryFundamentalsRepository {
  const repo = new InMemoryFundamentalsRepository([
    {
      symbol: "VOO",
      name: "Vanguard S&P 500 ETF",
      instrumentType: "ETF",
      expenseRatio: 0.0003,
      distributionYield: 0.013,
      buyScore: 82,
      price: 420.5,
    },
    {
      symbol: "QQQ",
      name: "Invesco QQQ Trust",
      instrumentType: "ETF",
      expenseRatio: 0.002,
      distributionYield: 0.009,
      buyScore: 76,
      price: 355.1,
    },
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      instrumentType: "EQUITY",
      buyScore: 78,
      price: 172.3,
    },
    {
      symbol: "MSFT",
      name: "Microsoft Corp.",
      instrumentType: "EQUITY",
      buyScore: 81,
      price: 329.4,
    },
    {
      symbol: "SCHD",
      name: "Schwab U.S. Dividend Equity ETF",
      instrumentType: "ETF",
      expenseRatio: 0.0006,
      distributionYield: 0.031,
      buyScore: 75,
      price: 73.7,
    },
  ]);

  return repo;
}

const viewsRepository = new AppViewsRepository();
viewsRepository.load([
  { symbol: "AAPL", views: 1923 },
  { symbol: "MSFT", views: 1640 },
  { symbol: "VOO", views: 1344 },
  { symbol: "QQQ", views: 1198 },
  { symbol: "SCHD", views: 880 },
]);

const fundamentalsRepository = buildFundamentalsRepository();

const alphaVantageClient = new AlphaVantageClient({
  apiKey: process.env.ALPHA_VANTAGE_API_KEY ?? "demo",
});

const recommendationService = new RecommendationService({
  alphaVantageClient,
  appViewsRepository: viewsRepository,
  fundamentalsRepository,
});

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 6;

  const recommendations = await recommendationService.build(limit);
  return Response.json(recommendations);
}
