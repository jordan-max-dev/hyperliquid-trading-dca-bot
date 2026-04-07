import { z } from "zod";

const booleanFromEnv = z
  .string()
  .optional()
  .transform((value) => value?.toLowerCase() === "true");

const numberFromEnv = (fallback: number, min?: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined ? fallback : Number(value)))
    .refine((value) => Number.isFinite(value), "Expected a valid number")
    .refine((value) => (min === undefined ? true : value >= min), `Expected a number >= ${min ?? 0}`);

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  LIVE_TRADING: booleanFromEnv.default(false),
  ENABLE_DEAD_MAN_SWITCH: booleanFromEnv.default(true),
  HL_NETWORK: z.enum(["mainnet", "testnet"]).default("mainnet"),
  HL_ACCOUNT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  HL_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  HL_VAULT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  HL_DEX: z.string().optional(),
  STATE_DB_PATH: z.string().default("./data/bot.db"),
  LOOP_INTERVAL_SECONDS: numberFromEnv(20, 5),
  SYMBOL: z.string().default("BTC"),
  SIDE: z.enum(["long", "short"]).default("long"),
  BASE_ORDER_USD: numberFromEnv(25, 10),
  MAX_TOTAL_BUDGET_USD: numberFromEnv(250, 10),
  LADDER_MAX_STEPS: numberFromEnv(5, 1),
  COOLDOWN_SECONDS: numberFromEnv(900, 10),
  DIP_INTERVAL_PCT: numberFromEnv(1.2, 0.1),
  SIZE_SCALE: numberFromEnv(1.2, 1),
  ENTRY_DISCOUNT_BPS: numberFromEnv(5, 0),
  MIN_TREND_BPS: numberFromEnv(-20),
  MAX_VOLATILITY_PCT: numberFromEnv(3.5, 0.1),
  MAX_SPREAD_BPS: numberFromEnv(12, 0.1),
  MAX_FUNDING_RATE: numberFromEnv(0.0008, 0),
  LEVERAGE: numberFromEnv(2, 1),
  MAX_NOTIONAL_USD: numberFromEnv(500, 10),
  MAX_SLIPPAGE_BPS: numberFromEnv(15, 0.1),
  MAX_DAILY_LOSS_USD: numberFromEnv(50, 1),
  MAX_DRAWDOWN_PCT: numberFromEnv(8, 0.1),
  MIN_ACCOUNT_VALUE_USD: numberFromEnv(100, 1),
  PRICE_HISTORY_LIMIT: numberFromEnv(120, 20),
});

export type EnvConfig = z.infer<typeof envSchema>;
