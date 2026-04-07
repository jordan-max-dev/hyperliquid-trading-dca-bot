import { buildSignalSnapshot } from "./signals.js";
import type { EntryIntent, StrategyContext, StrategyDecision } from "../types/strategy.js";

function nextBudgetUsd(baseOrderUsd: number, step: number, scale: number): number {
  return baseOrderUsd * scale ** step;
}

function desiredEntryPrice(markPrice: number, side: "long" | "short", entryDiscountBps: number): number {
  const discount = entryDiscountBps / 10_000;
  return side === "long" ? markPrice * (1 - discount) : markPrice * (1 + discount);
}

function dipTriggerHit(
  lastEntryPrice: number | null,
  markPrice: number,
  side: "long" | "short",
  dipIntervalPct: number,
  step: number,
): boolean {
  if (lastEntryPrice === null || step === 0) {
    return true;
  }

  const triggerDistance = (dipIntervalPct / 100) * step;
  const triggerPrice =
    side === "long"
      ? lastEntryPrice * (1 - triggerDistance)
      : lastEntryPrice * (1 + triggerDistance);

  return side === "long" ? markPrice <= triggerPrice : markPrice >= triggerPrice;
}

export class DcaStrategy {
  evaluate(context: StrategyContext): StrategyDecision {
    const signal = buildSignalSnapshot({
      prices: context.recentPrices,
      market: context.market,
      minTrendBps: context.config.minTrendBps,
      maxVolatilityPct: context.config.maxVolatilityPct,
      maxSpreadBps: context.config.maxSpreadBps,
      maxFundingRate: context.config.maxFundingRate,
    });

    if (!signal.shouldEnter) {
      return {
        action: "wait",
        reason: signal.reason,
        signal,
      };
    }

    if (context.state.ladderStep >= context.config.ladderMaxSteps) {
      return {
        action: "wait",
        reason: "ladder already reached maximum number of steps",
        signal,
      };
    }

    if (context.state.totalAllocatedUsd >= context.config.maxTotalBudgetUsd) {
      return {
        action: "wait",
        reason: "allocated capital already reached the configured budget cap",
        signal,
      };
    }

    if (
      context.state.lastEntryAt !== null &&
      context.now - context.state.lastEntryAt < context.config.cooldownSeconds * 1000
    ) {
      return {
        action: "wait",
        reason: "cooldown window is still active",
        signal,
      };
    }

    if (
      !dipTriggerHit(
        context.state.lastEntryPrice,
        context.market.markPrice,
        context.config.side,
        context.config.dipIntervalPct,
        context.state.ladderStep,
      )
    ) {
      return {
        action: "wait",
        reason: "next ladder dip trigger has not been reached yet",
        signal,
      };
    }

    const budgetUsd = nextBudgetUsd(
      context.config.baseOrderUsd,
      context.state.ladderStep,
      context.config.sizeScale,
    );
    const remainingBudget = context.config.maxTotalBudgetUsd - context.state.totalAllocatedUsd;
    const cappedBudgetUsd = Math.min(budgetUsd, remainingBudget);

    if (cappedBudgetUsd < 10) {
      return {
        action: "wait",
        reason: "remaining DCA budget is below Hyperliquid minimum order value",
        signal,
      };
    }

    const intent: EntryIntent = {
      symbol: context.market.symbol,
      side: context.config.side,
      step: context.state.ladderStep,
      budgetUsd: cappedBudgetUsd,
      referencePrice: context.market.markPrice,
      desiredLimitPrice: desiredEntryPrice(
        context.market.markPrice,
        context.config.side,
        context.config.entryDiscountBps,
      ),
      reason: `step ${context.state.ladderStep + 1} entry after ${signal.reason}`,
    };

    return {
      action: "enter",
      reason: intent.reason,
      signal,
      intent,
    };
  }
}
