export type TradeSide = "long" | "short";
export type BotMode = "dry-run" | "live";

export interface DcaStrategyConfig {
  symbol: string;
  side: TradeSide;
  baseOrderUsd: number;
  maxTotalBudgetUsd: number;
  ladderMaxSteps: number;
  cooldownSeconds: number;
  dipIntervalPct: number;
  sizeScale: number;
  entryDiscountBps: number;
  minTrendBps: number;
  maxVolatilityPct: number;
  maxSpreadBps: number;
  maxFundingRate: number;
  leverage: number;
}

export interface RiskLimits {
  maxNotionalUsd: number;
  maxSlippageBps: number;
  maxDailyLossUsd: number;
  maxDrawdownPct: number;
  minAccountValueUsd: number;
}

export interface MarketSnapshot {
  symbol: string;
  assetId: number;
  sizeDecimals: number;
  markPrice: number;
  oraclePrice: number;
  midPrice: number;
  fundingRate: number;
  spreadBps: number;
  dailyVolumeUsd: number;
  openInterest: number;
  maxLeverage: number;
  timestamp: number;
}

export interface PositionSnapshot {
  symbol: string;
  size: number;
  entryPrice: number;
  positionValueUsd: number;
  unrealizedPnlUsd: number;
  liquidationPrice: number | null;
  leverage: number;
  marginUsedUsd: number;
}

export interface AccountSnapshot {
  accountAddress: string | null;
  accountValueUsd: number;
  withdrawableUsd: number;
  totalMarginUsedUsd: number;
  totalNotionalUsd: number;
  dailyRealizedPnlUsd: number;
  drawdownPct: number;
  positions: PositionSnapshot[];
  openOrders: OpenOrderSnapshot[];
  timestamp: number;
}

export interface OpenOrderSnapshot {
  symbol: string;
  orderId: number;
  clientOrderId: string | null;
  side: TradeSide;
  price: number;
  size: number;
  reduceOnly: boolean;
  timestamp: number;
}

export interface StrategyState {
  symbol: string;
  ladderStep: number;
  totalAllocatedUsd: number;
  lastEntryPrice: number | null;
  lastEntryAt: number | null;
  lastSignal: string;
}

export interface SignalSnapshot {
  trendBps: number;
  realizedVolatilityPct: number;
  spreadBps: number;
  fundingRate: number;
  shouldEnter: boolean;
  reason: string;
}

export interface StrategyContext {
  config: DcaStrategyConfig;
  market: MarketSnapshot;
  account: AccountSnapshot;
  state: StrategyState;
  recentPrices: number[];
  now: number;
}

export interface EntryIntent {
  symbol: string;
  side: TradeSide;
  step: number;
  budgetUsd: number;
  referencePrice: number;
  desiredLimitPrice: number;
  reason: string;
}

export interface StrategyDecision {
  action: "enter" | "wait";
  reason: string;
  signal: SignalSnapshot;
  intent?: EntryIntent;
}

export interface RiskDecision {
  allowed: boolean;
  reason: string;
  severity: "info" | "warn" | "halt";
}

export interface PlannedOrder {
  symbol: string;
  assetId: number;
  side: TradeSide;
  reduceOnly: boolean;
  limitPrice: number;
  size: number;
  notionalUsd: number;
  clientOrderId: string;
  tif: "Gtc" | "Alo" | "Ioc";
  reason: string;
}

export interface ExecutionResult {
  mode: BotMode;
  status: "placed" | "filled" | "simulated" | "rejected";
  orderId: number | null;
  clientOrderId: string;
  averagePrice: number | null;
  size: number;
  reason: string;
  raw?: unknown;
}
