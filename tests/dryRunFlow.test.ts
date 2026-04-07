import { describe, expect, it } from "vitest";

import { DcaStrategy } from "../src/strategy/dcaStrategy.js";
import { RiskEngine } from "../src/risk/riskEngine.js";
import { OrderPlanner } from "../src/execution/orderPlanner.js";

describe("dry-run flow", () => {
  it("produces a valid order intent without touching live APIs", () => {
    const strategy = new DcaStrategy();
    const risk = new RiskEngine({
      maxNotionalUsd: 500,
      maxSlippageBps: 20,
      maxDailyLossUsd: 50,
      maxDrawdownPct: 8,
      minAccountValueUsd: 100,
    });
    const planner = new OrderPlanner();

    const decision = strategy.evaluate({
      config: {
        symbol: "BTC",
        side: "long",
        baseOrderUsd: 25,
        maxTotalBudgetUsd: 250,
        ladderMaxSteps: 5,
        cooldownSeconds: 60,
        dipIntervalPct: 1,
        sizeScale: 1.2,
        entryDiscountBps: 5,
        minTrendBps: -50,
        maxVolatilityPct: 4,
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
      recentPrices: [98, 99, 99.5, 99.8, 100, 100.1, 100.2, 100.4, 100.6, 100.7, 100.9, 101],
      now: Date.now(),
    });

    expect(decision.action).toBe("enter");
    expect(decision.intent).toBeDefined();

    const riskDecision = risk.evaluate({
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
      intent: decision.intent!,
      leverage: 2,
      ladderMaxSteps: 5,
      currentStep: 0,
    });

    expect(riskDecision.allowed).toBe(true);

    const order = planner.plan(
      decision.intent!,
      {
        symbol: "BTC",
        assetId: 0,
        sizeDecimals: 3,
        maxLeverage: 20,
      },
      "0x33333333333333333333333333333333",
    );

    expect(order.notionalUsd).toBeGreaterThanOrEqual(10);
    expect(order.tif).toBe("Alo");
  });
});
