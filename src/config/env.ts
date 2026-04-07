import path from "node:path";

import { config as loadDotEnv } from "dotenv";

import { envSchema } from "./schema.js";
import type { EnvConfig } from "./schema.js";
import type { BotMode, DcaStrategyConfig, RiskLimits } from "../types/strategy.js";

export interface AppConfig {
  env: EnvConfig;
  mode: BotMode;
  strategy: DcaStrategyConfig;
  risk: RiskLimits;
  dbPath: string;
  loopIntervalMs: number;
  deadManSwitchEnabled: boolean;
}

export function loadConfig(): AppConfig {
  loadDotEnv();

  const env = envSchema.parse(process.env);
  const mode: BotMode = env.LIVE_TRADING ? "live" : "dry-run";

  if (mode === "live" && (!env.HL_PRIVATE_KEY || !env.HL_ACCOUNT_ADDRESS)) {
    throw new Error("Live trading requires both HL_PRIVATE_KEY and HL_ACCOUNT_ADDRESS.");
  }

  return {
    env,
    mode,
    strategy: {
      symbol: env.SYMBOL.toUpperCase(),
      side: env.SIDE,
      baseOrderUsd: env.BASE_ORDER_USD,
      maxTotalBudgetUsd: env.MAX_TOTAL_BUDGET_USD,
      ladderMaxSteps: Math.floor(env.LADDER_MAX_STEPS),
      cooldownSeconds: env.COOLDOWN_SECONDS,
      dipIntervalPct: env.DIP_INTERVAL_PCT,
      sizeScale: env.SIZE_SCALE,
      entryDiscountBps: env.ENTRY_DISCOUNT_BPS,
      minTrendBps: env.MIN_TREND_BPS,
      maxVolatilityPct: env.MAX_VOLATILITY_PCT,
      maxSpreadBps: env.MAX_SPREAD_BPS,
      maxFundingRate: env.MAX_FUNDING_RATE,
      leverage: env.LEVERAGE,
    },
    risk: {
      maxNotionalUsd: env.MAX_NOTIONAL_USD,
      maxSlippageBps: env.MAX_SLIPPAGE_BPS,
      maxDailyLossUsd: env.MAX_DAILY_LOSS_USD,
      maxDrawdownPct: env.MAX_DRAWDOWN_PCT,
      minAccountValueUsd: env.MIN_ACCOUNT_VALUE_USD,
    },
    dbPath: path.resolve(env.STATE_DB_PATH),
    loopIntervalMs: env.LOOP_INTERVAL_SECONDS * 1000,
    deadManSwitchEnabled: env.ENABLE_DEAD_MAN_SWITCH,
  };
}
