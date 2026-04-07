import pino from "pino";

export function createLogger(level: string) {
  return pino({
    level: level as pino.LevelWithSilent,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: null,
  });
}

export type Logger = ReturnType<typeof createLogger>;
