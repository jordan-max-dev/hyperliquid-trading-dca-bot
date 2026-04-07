import type { ExecutionResult, StrategyState } from "../types/strategy.js";

export interface StoredOrderRecord extends ExecutionResult {
  symbol: string;
  side: "long" | "short";
  limitPrice: number;
  notionalUsd: number;
  createdAt: number;
}

export interface EquitySnapshot {
  accountValueUsd: number;
  totalNotionalUsd: number;
  drawdownPct: number;
  dailyRealizedPnlUsd: number;
  timestamp: number;
}

export const createTablesSql = `
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_history (
  client_order_id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  status TEXT NOT NULL,
  mode TEXT NOT NULL,
  order_id INTEGER,
  average_price REAL,
  size REAL NOT NULL,
  limit_price REAL NOT NULL,
  notional_usd REAL NOT NULL,
  reason TEXT NOT NULL,
  raw_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS equity_snapshots (
  timestamp INTEGER PRIMARY KEY,
  account_value_usd REAL NOT NULL,
  total_notional_usd REAL NOT NULL,
  drawdown_pct REAL NOT NULL,
  daily_realized_pnl_usd REAL NOT NULL
);
`;

export function strategyStateKey(symbol: string): string {
  return `strategy:${symbol.toUpperCase()}`;
}

export const defaultStrategyState = (symbol: string): StrategyState => ({
  symbol,
  ladderStep: 0,
  totalAllocatedUsd: 0,
  lastEntryPrice: null,
  lastEntryAt: null,
  lastSignal: "boot",
});
