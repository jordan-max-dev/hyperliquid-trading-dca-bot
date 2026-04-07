import { HyperliquidClient } from "../hyperliquid/client.js";
import { HyperliquidWebsocketFeed } from "../hyperliquid/ws.js";
import { DcaStrategy } from "../strategy/dcaStrategy.js";
import { RiskEngine } from "../risk/riskEngine.js";
import { OrderExecutor } from "../execution/orderExecutor.js";
import { StateStore } from "../state/store.js";
import { createLogger } from "../logging/logger.js";
import { loadConfig } from "../config/env.js";
import type { AppConfig } from "../config/env.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class BotApp {
  readonly config: AppConfig;
  readonly logger;
  readonly store: StateStore;
  readonly client: HyperliquidClient;
  readonly strategy: DcaStrategy;
  readonly risk: RiskEngine;
  readonly executor: OrderExecutor;

  private readonly priceHistory: number[] = [];
  private feed: HyperliquidWebsocketFeed | null = null;
  private running = false;

  constructor(config = loadConfig()) {
    this.config = config;
    this.logger = createLogger(config.env.LOG_LEVEL);
    this.store = new StateStore(config.dbPath);
    this.client = new HyperliquidClient({
      network: config.env.HL_NETWORK,
      mode: config.mode,
      ...(config.env.HL_ACCOUNT_ADDRESS ? { accountAddress: config.env.HL_ACCOUNT_ADDRESS } : {}),
      ...(config.env.HL_PRIVATE_KEY ? { privateKey: config.env.HL_PRIVATE_KEY as `0x${string}` } : {}),
      ...(config.env.HL_VAULT_ADDRESS ? { vaultAddress: config.env.HL_VAULT_ADDRESS } : {}),
      ...(config.env.HL_DEX ? { dex: config.env.HL_DEX } : {}),
    });
    this.strategy = new DcaStrategy();
    this.risk = new RiskEngine(config.risk);
    this.executor = new OrderExecutor(config, this.client, this.store, this.logger);
  }

  async bootstrap(): Promise<void> {
    const market = await this.client.getMarketContext(this.config.strategy.symbol);
    this.appendPrice(market.snapshot.markPrice);

    this.feed = new HyperliquidWebsocketFeed(this.config.env.HL_NETWORK);
    await this.feed.subscribeToMarket(market.metadata, (snapshot) => this.appendPrice(snapshot.markPrice));

    const reconciliation = await this.client.reconcile();
    this.logger.info(
      {
        mode: this.config.mode,
        symbol: this.config.strategy.symbol,
        openOrders: reconciliation.openOrders.length,
        positions: reconciliation.positions.length,
      },
      "bot bootstrapped",
    );
  }

  async runOnce(): Promise<void> {
    const latestMarket = this.feed?.getLatestSnapshot();
    const market = latestMarket ?? (await this.client.getMarketContext(this.config.strategy.symbol)).snapshot;
    this.appendPrice(market.markPrice);

    const latestSnapshot = this.store.getLatestSnapshot();
    const account = await this.client.getAccountSnapshot({
      peakAccountValueUsd: this.store.getPeakAccountValue(),
      dailyRealizedPnlUsd: latestSnapshot?.dailyRealizedPnlUsd ?? 0,
    });

    this.store.recordEquity({
      accountValueUsd: account.accountValueUsd,
      totalNotionalUsd: account.totalNotionalUsd,
      drawdownPct: account.drawdownPct,
      dailyRealizedPnlUsd: account.dailyRealizedPnlUsd,
      timestamp: account.timestamp,
    });

    const state = this.store.getStrategyState(this.config.strategy.symbol);
    const decision = this.strategy.evaluate({
      config: this.config.strategy,
      market,
      account,
      state,
      recentPrices: this.priceHistory,
      now: Date.now(),
    });

    if (decision.action === "wait" || !decision.intent) {
      this.logger.debug(
        {
          symbol: market.symbol,
          reason: decision.reason,
          trendBps: decision.signal.trendBps,
          volatilityPct: decision.signal.realizedVolatilityPct,
        },
        "strategy decided to wait",
      );
      return;
    }

    const riskDecision = this.risk.evaluate({
      account,
      market,
      intent: decision.intent,
      leverage: this.config.strategy.leverage,
      ladderMaxSteps: this.config.strategy.ladderMaxSteps,
      currentStep: state.ladderStep,
    });

    if (!riskDecision.allowed) {
      this.logger.warn(
        {
          symbol: market.symbol,
          reason: riskDecision.reason,
          severity: riskDecision.severity,
        },
        "risk engine rejected entry",
      );
      return;
    }

    await this.executor.execute(decision.intent, state);
  }

  async runLoop(): Promise<void> {
    this.running = true;
    await this.bootstrap();

    while (this.running) {
      try {
        await this.runOnce();
      } catch (error) {
        this.logger.error({ err: error }, "bot iteration failed");
      }

      await sleep(this.config.loopIntervalMs);
    }
  }

  async status(): Promise<Record<string, unknown>> {
    const latestEquity = this.store.getLatestSnapshot();
    const latestOrders = this.store.listRecentOrders(5);
    const state = this.store.getStrategyState(this.config.strategy.symbol);
    const killSwitch = this.risk.getKillSwitchStatus();

    return {
      mode: this.config.mode,
      symbol: this.config.strategy.symbol,
      strategyState: state,
      killSwitch,
      latestEquity,
      recentOrders: latestOrders,
    };
  }

  async close(): Promise<void> {
    this.running = false;
    if (this.feed) {
      await this.feed.close();
      this.feed = null;
    }
    this.store.close();
  }

  private appendPrice(price: number): void {
    this.priceHistory.push(price);
    if (this.priceHistory.length > this.config.env.PRICE_HISTORY_LIMIT) {
      this.priceHistory.shift();
    }
  }
}
