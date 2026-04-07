import type { AppConfig } from "../config/env.js";
import type { DcaStrategyConfig } from "../types/strategy.js";

export function getStrategyConfig(config: AppConfig): DcaStrategyConfig {
  return config.strategy;
}
