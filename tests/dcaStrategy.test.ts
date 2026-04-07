import { describe, expect, it } from "vitest";

import { DcaStrategy } from "../src/strategy/dcaStrategy.js";
import type { StrategyContext } from "../src/types/strategy.js";

function buildContext(overrides: Partial<StrategyContext> = {}): StrategyContext {
  return {
    config: {
      symbol: "BTC",
      side: "long",
      baseOrderUsd: 25,
      maxTotalBudgetUsd: 250,
      ladderMaxSteps: 5,
      cooldownSeconds: 60,
      dipIntervalPct: 1,
      sizeScale: 1.25,
      entryDiscountBps: 5,
      minTrendBps: -50,
      maxVolatilityPct: 5,
      maxSpreadBps: 20,
      maxFundingRate: 0.001,
      leverage: 2,
    },
    market: {
      symbol: "BTC",
      assetId: 0,
      sizeDecimals: 3,
      markPrice: 100,
      oraclePrice: 100,
      midPrice: 100,
      fundingRate: 0.0001,
      spreadBps: 1,
      dailyVolumeUsd: 1_000_000,
      openInterest: 500_000,
      maxLeverage: 20,
      timestamp: Date.now(),
    },
    account: {
      accountAddress: null,
      accountValueUsd: 1000,
      withdrawableUsd: 1000,
      totalMarginUsedUsd: 0,
      totalNotionalUsd: 0,
      dailyRealizedPnlUsd: 0,
      drawdownPct: 0,
      positions: [],
      openOrders: [],
      timestamp: Date.now(),
    },
    state: {
      symbol: "BTC",
      ladderStep: 0,
      totalAllocatedUsd: 0,
      lastEntryPrice: null,
      lastEntryAt: null,
      lastSignal: "boot",
    },
    recentPrices: [98, 98.5, 99, 99.5, 100, 100, 100.2, 100.4, 100.5, 100.7, 100.9, 101.1, 101.2, 101.3, 101.4, 101.5, 101.6, 101.7, 101.8, 102],
    now: 1_700_000_000_000,
    ...overrides,
  };
}

describe("DcaStrategy", () => {
  it("creates an entry intent when signal and budget are healthy", () => {
    const strategy = new DcaStrategy();
    const decision = strategy.evaluate(buildContext());

    expect(decision.action).toBe("enter");
    expect(decision.intent?.budgetUsd).toBe(25);
    expect(decision.intent?.desiredLimitPrice).toBeLessThan(100);
  });

  it("waits during cooldown", () => {
    const strategy = new DcaStrategy();
    const decision = strategy.evaluate(
      buildContext({
        state: {
          symbol: "BTC",
          ladderStep: 1,
          totalAllocatedUsd: 25,
          lastEntryPrice: 100,
          lastEntryAt: 1_700_000_000_000 - 10_000,
          lastSignal: "prior",
        },
      }),
    );

    expect(decision.action).toBe("wait");
    expect(decision.reason).toContain("cooldown");
  });
});
