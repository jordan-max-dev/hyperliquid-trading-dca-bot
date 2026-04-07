import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { createTablesSql, defaultStrategyState, strategyStateKey } from "./schema.js";
import type { EquitySnapshot, StoredOrderRecord } from "./schema.js";
import type { StrategyState } from "../types/strategy.js";

export class StateStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec(createTablesSql);
  }

  getStrategyState(symbol: string): StrategyState {
    const row = this.db
      .prepare("SELECT value FROM kv_store WHERE key = ?")
      .get(strategyStateKey(symbol)) as { value: string } | undefined;

    if (!row) {
      return defaultStrategyState(symbol);
    }

    return JSON.parse(row.value) as StrategyState;
  }

  saveStrategyState(state: StrategyState): void {
    this.db
      .prepare(
        "INSERT INTO kv_store(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(strategyStateKey(state.symbol), JSON.stringify(state));
  }

  saveOrder(record: StoredOrderRecord): void {
    this.db
      .prepare(
        `INSERT INTO order_history (
          client_order_id, symbol, side, status, mode, order_id, average_price, size, limit_price,
          notional_usd, reason, raw_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(client_order_id) DO UPDATE SET
          status = excluded.status,
          mode = excluded.mode,
          order_id = excluded.order_id,
          average_price = excluded.average_price,
          size = excluded.size,
          limit_price = excluded.limit_price,
          notional_usd = excluded.notional_usd,
          reason = excluded.reason,
          raw_json = excluded.raw_json`,
      )
      .run(
        record.clientOrderId,
        record.symbol,
        record.side,
        record.status,
        record.mode,
        record.orderId,
        record.averagePrice,
        record.size,
        record.limitPrice,
        record.notionalUsd,
        record.reason,
        JSON.stringify(record.raw ?? null),
        record.createdAt,
      );
  }

  recordEquity(snapshot: EquitySnapshot): void {
    this.db
      .prepare(
        `INSERT INTO equity_snapshots (
          timestamp, account_value_usd, total_notional_usd, drawdown_pct, daily_realized_pnl_usd
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(timestamp) DO UPDATE SET
          account_value_usd = excluded.account_value_usd,
          total_notional_usd = excluded.total_notional_usd,
          drawdown_pct = excluded.drawdown_pct,
          daily_realized_pnl_usd = excluded.daily_realized_pnl_usd`,
      )
      .run(
        snapshot.timestamp,
        snapshot.accountValueUsd,
        snapshot.totalNotionalUsd,
        snapshot.drawdownPct,
        snapshot.dailyRealizedPnlUsd,
      );
  }

  getPeakAccountValue(): number | null {
    const row = this.db
      .prepare("SELECT MAX(account_value_usd) AS peak FROM equity_snapshots")
      .get() as { peak: number | null };
    return row.peak;
  }

  getLatestSnapshot(): EquitySnapshot | null {
    const row = this.db
      .prepare(
        `SELECT timestamp, account_value_usd, total_notional_usd, drawdown_pct, daily_realized_pnl_usd
         FROM equity_snapshots ORDER BY timestamp DESC LIMIT 1`,
      )
      .get() as
      | {
          timestamp: number;
          account_value_usd: number;
          total_notional_usd: number;
          drawdown_pct: number;
          daily_realized_pnl_usd: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      timestamp: row.timestamp,
      accountValueUsd: row.account_value_usd,
      totalNotionalUsd: row.total_notional_usd,
      drawdownPct: row.drawdown_pct,
      dailyRealizedPnlUsd: row.daily_realized_pnl_usd,
    };
  }

  listRecentOrders(limit = 20): StoredOrderRecord[] {
    const rows = this.db
      .prepare(
        `SELECT client_order_id, symbol, side, status, mode, order_id, average_price, size, limit_price,
                notional_usd, reason, raw_json, created_at
         FROM order_history ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit) as Array<{
      client_order_id: string;
      symbol: string;
      side: "long" | "short";
      status: StoredOrderRecord["status"];
      mode: StoredOrderRecord["mode"];
      order_id: number | null;
      average_price: number | null;
      size: number;
      limit_price: number;
      notional_usd: number;
      reason: string;
      raw_json: string | null;
      created_at: number;
    }>;

    return rows.map((row) => ({
      clientOrderId: row.client_order_id,
      symbol: row.symbol,
      side: row.side,
      status: row.status,
      mode: row.mode,
      orderId: row.order_id,
      averagePrice: row.average_price,
      size: row.size,
      limitPrice: row.limit_price,
      notionalUsd: row.notional_usd,
      reason: row.reason,
      raw: row.raw_json ? JSON.parse(row.raw_json) : undefined,
      createdAt: row.created_at,
    }));
  }

  close(): void {
    this.db.close();
  }
}
