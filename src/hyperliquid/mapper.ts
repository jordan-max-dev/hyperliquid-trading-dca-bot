import type { AccountSnapshot, MarketSnapshot, OpenOrderSnapshot, PositionSnapshot, TradeSide } from "../types/strategy.js";
import type { AccountStateRaw, AssetMetadata, MappedAccountState } from "./types.js";

function asNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

export function inferSide(size: number): TradeSide {
  return size >= 0 ? "long" : "short";
}

export function mapMarketSnapshot(metadata: AssetMetadata, ctx: Record<string, unknown>): MarketSnapshot {
  const markPrice = asNumber(ctx.markPx as string | undefined);
  const oraclePrice = asNumber(ctx.oraclePx as string | undefined) || markPrice;
  const midPrice = asNumber((ctx.midPx as string | null | undefined) ?? undefined) || markPrice;
  const spreadBps = midPrice > 0 ? (Math.abs(markPrice - midPrice) / midPrice) * 10_000 : 0;

  return {
    symbol: metadata.symbol,
    assetId: metadata.assetId,
    sizeDecimals: metadata.sizeDecimals,
    markPrice,
    oraclePrice,
    midPrice,
    fundingRate: asNumber(ctx.funding as string | undefined),
    spreadBps,
    dailyVolumeUsd: asNumber(ctx.dayNtlVlm as string | undefined),
    openInterest: asNumber(ctx.openInterest as string | undefined),
    maxLeverage: metadata.maxLeverage,
    timestamp: Date.now(),
  };
}

export function mapAccountState(raw: AccountStateRaw): MappedAccountState {
  const positions: PositionSnapshot[] = (raw.assetPositions ?? [])
    .map((entry) => entry.position)
    .filter((position): position is NonNullable<typeof position> => Boolean(position?.coin))
    .map((position) => ({
      symbol: position.coin ?? "UNKNOWN",
      size: asNumber(position.szi),
      entryPrice: asNumber(position.entryPx),
      positionValueUsd: asNumber(position.positionValue),
      unrealizedPnlUsd: asNumber(position.unrealizedPnl),
      liquidationPrice: position.liquidationPx ? asNumber(position.liquidationPx) : null,
      leverage: position.leverage?.value ?? 0,
      marginUsedUsd: asNumber(position.marginUsed),
    }));

  return {
    accountValueUsd: asNumber(raw.marginSummary?.accountValue),
    withdrawableUsd: asNumber(raw.withdrawable),
    totalMarginUsedUsd: asNumber(raw.marginSummary?.totalMarginUsed),
    totalNotionalUsd: asNumber(raw.marginSummary?.totalNtlPos),
    positions,
    timestamp: raw.time ?? Date.now(),
  };
}

export function mapOpenOrders(rawOrders: Array<Record<string, unknown>>): OpenOrderSnapshot[] {
  return rawOrders.map((order) => ({
    symbol: String(order.coin ?? "UNKNOWN"),
    orderId: Number(order.oid ?? 0),
    clientOrderId: order.cloid ? String(order.cloid) : null,
    side: order.side === "A" ? "short" : "long",
    price: asNumber(order.limitPx as string | undefined),
    size: asNumber(order.sz as string | undefined),
    reduceOnly: order.reduceOnly === true,
    timestamp: Number(order.timestamp ?? Date.now()),
  }));
}

export function buildAccountSnapshot(
  accountAddress: string | null,
  mappedState: MappedAccountState,
  openOrders: OpenOrderSnapshot[],
  dailyRealizedPnlUsd: number,
  drawdownPct: number,
): AccountSnapshot {
  return {
    accountAddress,
    accountValueUsd: mappedState.accountValueUsd,
    withdrawableUsd: mappedState.withdrawableUsd,
    totalMarginUsedUsd: mappedState.totalMarginUsedUsd,
    totalNotionalUsd: mappedState.totalNotionalUsd,
    positions: mappedState.positions,
    openOrders,
    dailyRealizedPnlUsd,
    drawdownPct,
    timestamp: mappedState.timestamp,
  };
}
