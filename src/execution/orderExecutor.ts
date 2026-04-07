import type { Logger } from "../logging/logger.js";
import type { HyperliquidClient } from "../hyperliquid/client.js";
import type { StateStore } from "../state/store.js";
import type { EntryIntent, StrategyState } from "../types/strategy.js";
import type { AppConfig } from "../config/env.js";
import { OrderPlanner } from "./orderPlanner.js";

export class OrderExecutor {
  private readonly planner = new OrderPlanner();

  constructor(
    private readonly config: AppConfig,
    private readonly client: HyperliquidClient,
    private readonly store: StateStore,
    private readonly logger: Logger,
  ) {}

  async execute(intent: EntryIntent, state: StrategyState): Promise<void> {
    const market = await this.client.getMarketContext(intent.symbol);
    const clientOrderId = this.client.createClientOrderId();
    const plannedOrder = this.planner.plan(intent, market.metadata, clientOrderId);

    await this.client.ensureLeverage(intent.symbol, this.config.strategy.leverage);
    if (this.config.deadManSwitchEnabled) {
      await this.client.scheduleCancelAll(Date.now() + 45_000);
    }

    const result = await this.client.placeLimitOrder(plannedOrder);

    this.store.saveOrder({
      ...result,
      symbol: plannedOrder.symbol,
      side: plannedOrder.side,
      limitPrice: plannedOrder.limitPrice,
      notionalUsd: plannedOrder.notionalUsd,
      createdAt: Date.now(),
    });

    this.store.saveStrategyState({
      ...state,
      ladderStep: state.ladderStep + 1,
      totalAllocatedUsd: Number((state.totalAllocatedUsd + plannedOrder.notionalUsd).toFixed(4)),
      lastEntryPrice: result.averagePrice ?? plannedOrder.limitPrice,
      lastEntryAt: Date.now(),
      lastSignal: plannedOrder.reason,
    });

    this.logger.info(
      {
        symbol: plannedOrder.symbol,
        clientOrderId,
        mode: result.mode,
        status: result.status,
        limitPrice: plannedOrder.limitPrice,
        size: plannedOrder.size,
        notionalUsd: plannedOrder.notionalUsd,
      },
      "entry order processed",
    );
  }
}
