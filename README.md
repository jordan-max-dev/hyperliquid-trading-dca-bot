# Hyperliquid DCA Bot

TypeScript Hyperliquid DCA bot built for perpetuals first, with `dry-run` as the default operating mode and explicit risk controls before live execution.

## What It Does

- Connects to Hyperliquid for perp market data, account state, and order execution.
- Applies a configurable DCA strategy with ladder sizing, cooldowns, dip-based scaling, and entry guards.
- Enforces live-safety controls such as account-value checks, drawdown caps, daily loss limits, slippage checks, and a kill-switch.
- Persists strategy state and order history in a local SQLite database so restarts do not blindly duplicate DCA legs.

## Quick Start

```bash
npm install
cp .env.example .env
npm run build
npm run test
```

Validate configuration:

```bash
npm run dev -- validate-config
```

Inspect the latest persisted status:

```bash
npm run dev -- status
```

Run the bot:

```bash
npm run dev
```

## Safety Notes

- `LIVE_TRADING=false` keeps the bot in `dry-run` mode. No real orders are sent in this mode.
- For live trading, use a dedicated Hyperliquid API wallet instead of a primary wallet.
- Keep `ENABLE_DEAD_MAN_SWITCH=true` in live mode so the bot regularly refreshes a cancel-all timer.
- Start with small sizing and verify `status` output before enabling live trading.

## Main Modules

- `src/hyperliquid/`: exchange client, websocket feed, and response mappers
- `src/strategy/`: DCA strategy and signal calculations
- `src/risk/`: limit checks and kill-switch handling
- `src/execution/`: order planning and submission
- `src/state/`: SQLite-backed persistence
- `src/app/bot.ts`: orchestration loop

## Configuration Highlights

- `SYMBOL`, `SIDE`, `BASE_ORDER_USD`, `MAX_TOTAL_BUDGET_USD`: define the DCA ladder
- `DIP_INTERVAL_PCT`, `SIZE_SCALE`, `COOLDOWN_SECONDS`: define step spacing and cadence
- `MAX_SPREAD_BPS`, `MAX_VOLATILITY_PCT`, `MAX_FUNDING_RATE`: market-entry filters
- `MAX_NOTIONAL_USD`, `MAX_DAILY_LOSS_USD`, `MAX_DRAWDOWN_PCT`, `MIN_ACCOUNT_VALUE_USD`: hard risk guards

## Commands

- `npm run dev` runs the loop in TypeScript
- `npm run build` compiles to `dist/`
- `npm run lint` runs ESLint
- `npm run test` runs focused unit tests
