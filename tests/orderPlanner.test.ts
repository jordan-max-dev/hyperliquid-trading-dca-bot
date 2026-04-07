import { describe, expect, it } from "vitest";

import { OrderPlanner } from "../src/execution/orderPlanner.js";

describe("OrderPlanner", () => {
  it("rounds price and size into a valid Hyperliquid limit order", () => {
    const planner = new OrderPlanner();
    const order = planner.plan(
      {
        symbol: "BTC",
        side: "long",
        step: 0,
        budgetUsd: 25,
        referencePrice: 100.1234,
        desiredLimitPrice: 100.1234,
        reason: "test",
      },
      {
        symbol: "BTC",
        assetId: 0,
        sizeDecimals: 3,
        maxLeverage: 20,
      },
      "0x11111111111111111111111111111111",
    );

    expect(order.limitPrice).toBe(100.123);
    expect(order.size).toBe(0.249);
    expect(order.notionalUsd).toBeGreaterThanOrEqual(10);
  });

  it("rejects too-small notional orders", () => {
    const planner = new OrderPlanner();

    expect(() =>
      planner.plan(
        {
          symbol: "BTC",
          side: "long",
          step: 0,
          budgetUsd: 5,
          referencePrice: 100,
          desiredLimitPrice: 100,
          reason: "small",
        },
        {
          symbol: "BTC",
          assetId: 0,
          sizeDecimals: 3,
          maxLeverage: 20,
        },
        "0x22222222222222222222222222222222",
      ),
    ).toThrow(/minimum Hyperliquid order value/i);
  });
});
