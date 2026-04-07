import { evaluateCoreRisk } from "./limits.js";
import { KillSwitch } from "./killSwitch.js";
import type { AccountSnapshot, EntryIntent, MarketSnapshot, RiskDecision, RiskLimits } from "../types/strategy.js";

export class RiskEngine {
  constructor(
    private readonly limits: RiskLimits,
    private readonly killSwitch = new KillSwitch(),
  ) {}

  evaluate(input: {
    account: AccountSnapshot;
    market: MarketSnapshot;
    intent: EntryIntent;
    leverage: number;
    ladderMaxSteps: number;
    currentStep: number;
  }): RiskDecision {
    const status = this.killSwitch.getStatus();
    if (status.halted) {
      return {
        allowed: false,
        severity: "halt",
        reason: `kill-switch active: ${status.reason}`,
      };
    }

    const decision = evaluateCoreRisk({
      account: input.account,
      intent: input.intent,
      market: input.market,
      limits: this.limits,
      maxLeverage: input.leverage,
      ladderMaxSteps: input.ladderMaxSteps,
      currentStep: input.currentStep,
    });

    if (!decision.allowed && decision.severity === "halt") {
      this.killSwitch.trigger(decision.reason);
    }

    return decision;
  }

  getKillSwitchStatus(): { halted: boolean; reason: string } {
    return this.killSwitch.getStatus();
  }

  releaseKillSwitch(): void {
    this.killSwitch.clear();
  }
}
