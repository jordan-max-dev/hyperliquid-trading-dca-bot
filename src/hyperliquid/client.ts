import { randomBytes } from "node:crypto";

import { ExchangeClient, HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";

import { buildAccountSnapshot, mapAccountState, mapMarketSnapshot, mapOpenOrders } from "./mapper.js";
import type { AssetMetadata, HyperliquidClientOptions, MarketContextBundle, ReconciliationSummary } from "./types.js";
import type { AccountSnapshot, ExecutionResult, PlannedOrder } from "../types/strategy.js";

export class HyperliquidClient {
  private readonly transport: HttpTransport;
  private readonly infoClient: InfoClient;
  private readonly exchangeClient: ExchangeClient | null;
  private metadataCache = new Map<string, AssetMetadata>();

  constructor(private readonly options: HyperliquidClientOptions) {
    this.transport = new HttpTransport({
      isTestnet: options.network === "testnet",
    });
    this.infoClient = new InfoClient({ transport: this.transport });

    if (options.privateKey) {
      const wallet = privateKeyToAccount(options.privateKey);
      this.exchangeClient = new ExchangeClient({
        transport: this.transport,
        wallet,
      });
    } else {
      this.exchangeClient = null;
    }
  }

  getAccountAddress(): string | null {
    return this.options.accountAddress ?? null;
  }

  async getMarketContext(symbol: string): Promise<MarketContextBundle> {
    const [meta, contexts] = await this.infoClient.metaAndAssetCtxs(this.options.dex ? { dex: this.options.dex } : undefined);
    const assetIndex = meta.universe.findIndex((asset) => asset.name === symbol);

    if (assetIndex < 0) {
      throw new Error(`Unknown Hyperliquid perp symbol: ${symbol}`);
    }

    const universe = meta.universe[assetIndex];
    const ctx = contexts[assetIndex];

    if (!universe || !ctx) {
      throw new Error(`Missing market context for symbol: ${symbol}`);
    }

    const metadata: AssetMetadata = {
      symbol,
      assetId: assetIndex,
      sizeDecimals: universe.szDecimals,
      maxLeverage: universe.maxLeverage,
    };
    this.metadataCache.set(symbol, metadata);

    return {
      metadata,
      snapshot: mapMarketSnapshot(metadata, ctx as unknown as Record<string, unknown>),
    };
  }

  async getAccountSnapshot(params: {
    peakAccountValueUsd: number | null;
    dailyRealizedPnlUsd: number;
  }): Promise<AccountSnapshot> {
    if (!this.options.accountAddress) {
      return {
        accountAddress: null,
        accountValueUsd: this.options.mode === "dry-run" ? 10_000 : 0,
        withdrawableUsd: 0,
        totalMarginUsedUsd: 0,
        totalNotionalUsd: 0,
        dailyRealizedPnlUsd: params.dailyRealizedPnlUsd,
        drawdownPct: 0,
        positions: [],
        openOrders: [],
        timestamp: Date.now(),
      };
    }

    const [stateRaw, openOrdersRaw] = await Promise.all([
      this.infoClient.clearinghouseState({
        user: this.options.accountAddress,
        ...(this.options.dex ? { dex: this.options.dex } : {}),
      }),
      this.infoClient.openOrders({
        user: this.options.accountAddress,
        ...(this.options.dex ? { dex: this.options.dex } : {}),
      }),
    ]);

    const mapped = mapAccountState(stateRaw as never);
    const openOrders = mapOpenOrders(openOrdersRaw as never);
    const peak = params.peakAccountValueUsd ?? mapped.accountValueUsd;
    const drawdownPct = peak > 0 ? Math.max(0, ((peak - mapped.accountValueUsd) / peak) * 100) : 0;

    return buildAccountSnapshot(
      this.options.accountAddress,
      mapped,
      openOrders,
      params.dailyRealizedPnlUsd,
      drawdownPct,
    );
  }

  async reconcile(): Promise<ReconciliationSummary> {
    if (!this.options.accountAddress) {
      return { openOrders: [], positions: [] };
    }

    const snapshot = await this.getAccountSnapshot({
      peakAccountValueUsd: null,
      dailyRealizedPnlUsd: 0,
    });

    return {
      openOrders: snapshot.openOrders,
      positions: snapshot.positions,
    };
  }

  async ensureLeverage(symbol: string, leverage: number): Promise<void> {
    if (this.options.mode !== "live" || !this.exchangeClient) {
      return;
    }

    const metadata = this.metadataCache.get(symbol) ?? (await this.getMarketContext(symbol)).metadata;
    const safeLeverage = Math.min(Math.floor(leverage), metadata.maxLeverage);

    await this.exchangeClient.updateLeverage(
      {
        asset: metadata.assetId,
        isCross: true,
        leverage: safeLeverage,
      },
      this.options.vaultAddress ? { vaultAddress: this.options.vaultAddress } : undefined,
    );
  }

  async scheduleCancelAll(triggerAtMs: number): Promise<void> {
    if (this.options.mode !== "live" || !this.exchangeClient) {
      return;
    }

    await this.exchangeClient.scheduleCancel(
      { time: triggerAtMs },
      this.options.vaultAddress ? { vaultAddress: this.options.vaultAddress } : undefined,
    );
  }

  async placeLimitOrder(order: PlannedOrder): Promise<ExecutionResult> {
    if (this.options.mode !== "live" || !this.exchangeClient) {
      return {
        mode: this.options.mode,
        status: "simulated",
        orderId: null,
        clientOrderId: order.clientOrderId,
        averagePrice: order.limitPrice,
        size: order.size,
        reason: order.reason,
        raw: { simulated: true, order },
      };
    }

    const response = await this.exchangeClient.order(
      {
        orders: [
          {
            a: order.assetId,
            b: order.side === "long",
            p: order.limitPrice.toFixed(8).replace(/0+$/, "").replace(/\.$/, ""),
            s: order.size.toFixed(8).replace(/0+$/, "").replace(/\.$/, ""),
            r: order.reduceOnly,
            t: { limit: { tif: order.tif } },
            c: order.clientOrderId as `0x${string}`,
          },
        ],
        grouping: "na",
      },
      this.options.vaultAddress ? { vaultAddress: this.options.vaultAddress } : undefined,
    );

    const status = response.response.data.statuses[0];
    if (!status) {
      throw new Error("Hyperliquid returned an empty order status response.");
    }

    if (typeof status === "object" && status !== null && "resting" in status) {
      return {
        mode: this.options.mode,
        status: "placed",
        orderId: status.resting.oid,
        clientOrderId: order.clientOrderId,
        averagePrice: order.limitPrice,
        size: order.size,
        reason: order.reason,
        raw: response,
      };
    }

    if (typeof status === "object" && status !== null && "filled" in status) {
      return {
        mode: this.options.mode,
        status: "filled",
        orderId: status.filled.oid,
        clientOrderId: order.clientOrderId,
        averagePrice: Number(status.filled.avgPx),
        size: Number(status.filled.totalSz),
        reason: order.reason,
        raw: response,
      };
    }

    return {
      mode: this.options.mode,
      status: "placed",
      orderId: null,
      clientOrderId: order.clientOrderId,
      averagePrice: order.limitPrice,
      size: order.size,
      reason: order.reason,
      raw: response,
    };
  }

  createClientOrderId(): `0x${string}` {
    return `0x${randomBytes(16).toString("hex")}`;
  }
}
