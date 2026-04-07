import type { BotMode, MarketSnapshot, OpenOrderSnapshot, PositionSnapshot } from "../types/strategy.js";

export interface HyperliquidClientOptions {
  network: "mainnet" | "testnet";
  accountAddress?: string;
  privateKey?: `0x${string}`;
  vaultAddress?: string;
  dex?: string;
  mode: BotMode;
}

export interface AssetMetadata {
  symbol: string;
  assetId: number;
  sizeDecimals: number;
  maxLeverage: number;
}

export interface AccountStateRaw {
  marginSummary?: {
    accountValue?: string;
    totalNtlPos?: string;
    totalMarginUsed?: string;
  };
  withdrawable?: string;
  assetPositions?: Array<{
    position?: {
      coin?: string;
      szi?: string;
      entryPx?: string;
      positionValue?: string;
      unrealizedPnl?: string;
      liquidationPx?: string | null;
      leverage?: {
        type?: string;
        value?: number;
      };
      marginUsed?: string;
    };
  }>;
  time?: number;
}

export interface MappedAccountState {
  accountValueUsd: number;
  withdrawableUsd: number;
  totalMarginUsedUsd: number;
  totalNotionalUsd: number;
  positions: PositionSnapshot[];
  timestamp: number;
}

export interface MarketContextBundle {
  metadata: AssetMetadata;
  snapshot: MarketSnapshot;
}

export type MarketUpdateHandler = (snapshot: MarketSnapshot) => void;

export interface ReconciliationSummary {
  openOrders: OpenOrderSnapshot[];
  positions: PositionSnapshot[];
}
