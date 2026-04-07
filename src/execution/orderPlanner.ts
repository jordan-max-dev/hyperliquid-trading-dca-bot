import type { EntryIntent, PlannedOrder } from "../types/strategy.js";
import type { AssetMetadata } from "../hyperliquid/types.js";

function roundDown(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.floor(value * factor) / factor;
}

function roundPrice(value: number): number {
  if (value >= 10_000) {
    return Number(value.toFixed(1));
  }

  if (value >= 1_000) {
    return Number(value.toFixed(2));
  }

  if (value >= 1) {
    return Number(value.toFixed(3));
  }

  return Number(value.toFixed(5));
}

export class OrderPlanner {
  plan(intent: EntryIntent, metadata: AssetMetadata, clientOrderId: string): PlannedOrder {
    const limitPrice = roundPrice(intent.desiredLimitPrice);
    const size = roundDown(intent.budgetUsd / limitPrice, metadata.sizeDecimals);
    const notionalUsd = Number((size * limitPrice).toFixed(4));

    if (size <= 0 || notionalUsd < 10) {
      throw new Error("Planned order does not satisfy minimum Hyperliquid order value.");
    }

    return {
      symbol: intent.symbol,
      assetId: metadata.assetId,
      side: intent.side,
      reduceOnly: false,
      limitPrice,
      size,
      notionalUsd,
      clientOrderId,
      tif: "Alo",
      reason: intent.reason,
    };
  }
}
