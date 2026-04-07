import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";

import { mapMarketSnapshot } from "./mapper.js";
import type { AssetMetadata, MarketUpdateHandler } from "./types.js";
import type { MarketSnapshot } from "../types/strategy.js";

interface DisposableSubscription {
  unsubscribe(): void | Promise<void>;
}

export class HyperliquidWebsocketFeed {
  private readonly transport: WebSocketTransport;
  private readonly client: SubscriptionClient;
  private subscription: DisposableSubscription | null = null;
  private latestSnapshot: MarketSnapshot | null = null;

  constructor(private readonly network: "mainnet" | "testnet") {
    this.transport = new WebSocketTransport({
      url: network === "testnet" ? "wss://api.hyperliquid-testnet.xyz/ws" : "wss://api.hyperliquid.xyz/ws",
    });
    this.client = new SubscriptionClient({ transport: this.transport });
  }

  async subscribeToMarket(metadata: AssetMetadata, onUpdate?: MarketUpdateHandler): Promise<void> {
    this.subscription = (await this.client.activeAssetCtx({ coin: metadata.symbol }, (data) => {
      const snapshot = mapMarketSnapshot(metadata, data as Record<string, unknown>);
      this.latestSnapshot = snapshot;
      onUpdate?.(snapshot);
    })) as DisposableSubscription;
  }

  getLatestSnapshot(): MarketSnapshot | null {
    return this.latestSnapshot;
  }

  async close(): Promise<void> {
    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;
    }

    await this.transport.close();
  }
}
