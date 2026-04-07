import { describe, expect, it } from "vitest";

import { RiskEngine } from "../src/risk/riskEngine.js";

const engine = new RiskEngine({
  maxNotionalUsd: 500,
  maxSlippageBps: 20,
  maxDailyLossUsd: 50,
  maxDrawdownPct: 8,
  minAccountValueUsd: 100,
});

const baseInput = {
  account: {
    accountAddress: "0x1234567890123456789012345678901234567890",
    accountValueUsd: 1000,
    withdrawableUsd: 800,
    totalMarginUsedUsd: 50,
    totalNotionalUsd: 100,
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
    spreadBps: 2,
    dailyVolumeUsd: 1_000_000,
    openInterest: 500_000,
    maxLeverage: 20,
    timestamp: Date.now(),
  },
  intent: {
    symbol: "BTC",
    side: "long" as const,
    step: 0,
    budgetUsd: 25,
    referencePrice: 100,
    desiredLimitPrice: 99.95,
    reason: "test",
  },
  leverage: 2,
  ladderMaxSteps: 5,
  currentStep: 0,
};

describe("RiskEngine", () => {
  it("allows safe entries", () => {
    const decision = engine.evaluate(baseInput);
    expect(decision.allowed).toBe(true);
  });

  it("halts when drawdown is breached", () => {
    const decision = engine.evaluate({
      ...baseInput,
      account: {
        ...baseInput.account,
        drawdownPct: 12,
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.severity).toBe("halt");
  });
});
