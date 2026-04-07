import type { AccountSnapshot, EntryIntent, MarketSnapshot, RiskDecision, RiskLimits } from "../types/strategy.js";

export function maxProjectedNotional(account: AccountSnapshot, intent: EntryIntent): number {
  return account.totalNotionalUsd + intent.budgetUsd;
}

export function approximateSlippageBps(market: MarketSnapshot, desiredLimitPrice: number): number {
  if (market.markPrice <= 0) {
    return 0;
  }

  return (Math.abs(desiredLimitPrice - market.markPrice) / market.markPrice) * 10_000;
}

export function evaluateCoreRisk(input: {
  account: AccountSnapshot;
  intent: EntryIntent;
  market: MarketSnapshot;
  limits: RiskLimits;
  maxLeverage: number;
  ladderMaxSteps: number;
  currentStep: number;
}): RiskDecision {
  if (input.account.accountValueUsd < input.limits.minAccountValueUsd) {
    return { allowed: false, severity: "halt", reason: "account equity is below minimum threshold" };
  }

  if (input.account.dailyRealizedPnlUsd <= -Math.abs(input.limits.maxDailyLossUsd)) {
    return { allowed: false, severity: "halt", reason: "daily loss limit has been reached" };
  }

  if (input.account.drawdownPct >= input.limits.maxDrawdownPct) {
    return { allowed: false, severity: "halt", reason: "drawdown limit has been reached" };
  }

  if (maxProjectedNotional(input.account, input.intent) > input.limits.maxNotionalUsd) {
    return { allowed: false, severity: "warn", reason: "projected notional would exceed cap" };
  }

  if (approximateSlippageBps(input.market, input.intent.desiredLimitPrice) > input.limits.maxSlippageBps) {
    return { allowed: false, severity: "warn", reason: "entry price implies too much slippage" };
  }

  if (input.maxLeverage > input.market.maxLeverage) {
    return { allowed: false, severity: "warn", reason: "configured leverage exceeds market limit" };
  }

  if (input.currentStep >= input.ladderMaxSteps) {
    return { allowed: false, severity: "info", reason: "ladder depth limit already reached" };
  }

  return { allowed: true, severity: "info", reason: "risk checks passed" };
}
