import type { MarketSnapshot, SignalSnapshot } from "../types/strategy.js";

function pctChange(from: number, to: number): number {
  if (from === 0) {
    return 0;
  }

  return ((to - from) / from) * 100;
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculateTrendBps(prices: number[]): number {
  if (prices.length < 5) {
    return 0;
  }

  const shortWindow = prices.slice(-5);
  const longWindow = prices.slice(-20);
  const shortAverage = mean(shortWindow);
  const longAverage = mean(longWindow);

  if (longAverage === 0) {
    return 0;
  }

  return ((shortAverage - longAverage) / longAverage) * 10_000;
}

export function calculateRealizedVolatilityPct(prices: number[]): number {
  if (prices.length < 10) {
    return 0;
  }

  const returns = prices.slice(1).map((price, index) => pctChange(prices[index] ?? price, price));
  const avgReturn = mean(returns);
  const variance = returns.reduce((sum, value) => sum + (value - avgReturn) ** 2, 0) / returns.length;
  return Math.sqrt(variance);
}

export function buildSignalSnapshot(input: {
  prices: number[];
  market: MarketSnapshot;
  minTrendBps: number;
  maxVolatilityPct: number;
  maxSpreadBps: number;
  maxFundingRate: number;
}): SignalSnapshot {
  const trendBps = calculateTrendBps(input.prices);
  const realizedVolatilityPct = calculateRealizedVolatilityPct(input.prices);

  if (input.market.spreadBps > input.maxSpreadBps) {
    return {
      trendBps,
      realizedVolatilityPct,
      spreadBps: input.market.spreadBps,
      fundingRate: input.market.fundingRate,
      shouldEnter: false,
      reason: `spread ${input.market.spreadBps.toFixed(2)}bps exceeds limit`,
    };
  }

  if (Math.abs(input.market.fundingRate) > input.maxFundingRate) {
    return {
      trendBps,
      realizedVolatilityPct,
      spreadBps: input.market.spreadBps,
      fundingRate: input.market.fundingRate,
      shouldEnter: false,
      reason: `funding ${input.market.fundingRate.toFixed(6)} exceeds limit`,
    };
  }

  if (realizedVolatilityPct > input.maxVolatilityPct) {
    return {
      trendBps,
      realizedVolatilityPct,
      spreadBps: input.market.spreadBps,
      fundingRate: input.market.fundingRate,
      shouldEnter: false,
      reason: `volatility ${realizedVolatilityPct.toFixed(2)}% exceeds limit`,
    };
  }

  if (trendBps < input.minTrendBps) {
    return {
      trendBps,
      realizedVolatilityPct,
      spreadBps: input.market.spreadBps,
      fundingRate: input.market.fundingRate,
      shouldEnter: false,
      reason: `trend ${trendBps.toFixed(1)}bps below threshold`,
    };
  }

  return {
    trendBps,
    realizedVolatilityPct,
    spreadBps: input.market.spreadBps,
    fundingRate: input.market.fundingRate,
    shouldEnter: true,
    reason: "signal passes volatility, spread, funding, and trend checks",
  };
}
