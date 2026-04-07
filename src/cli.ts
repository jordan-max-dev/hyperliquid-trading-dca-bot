import { Command } from "commander";
import { logger } from "terminal-pretty-logger";

import { BotApp } from "./app/bot.js";
import { loadConfig } from "./config/env.js";

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("hyperliquid-dca-bot")
    .description("Live-ready Hyperliquid DCA bot with dry-run safety controls");

  program
    .command("validate-config")
    .description("Validate environment configuration and print the effective runtime mode")
    .action(() => {
      const config = loadConfig();
      logger.info(
        JSON.stringify(
          {
            mode: config.mode,
            symbol: config.strategy.symbol,
            network: config.env.HL_NETWORK,
            dbPath: config.dbPath,
          },
          null,
          2,
        ),
      );
    });

  program
    .command("status")
    .description("Print the latest persisted bot status")
    .action(async () => {
      const app = new BotApp();
      try {
        logger.info(JSON.stringify(await app.status(), null, 2));
      } finally {
        await app.close();
      }
    });

  program
    .command("run")
    .description("Run the bot loop")
    .action(async () => {
      const app = new BotApp();
      const shutdown = async () => {
        await app.close();
        process.exit(0);
      };

      process.once("SIGINT", () => void shutdown());
      process.once("SIGTERM", () => void shutdown());
      await app.runLoop();
    });

  await program.parseAsync(argv);
}
