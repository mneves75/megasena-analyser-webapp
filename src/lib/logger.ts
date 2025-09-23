import pino from "pino";

const transport =
  process.env.NODE_ENV !== "production"
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          singleLine: true,
        },
      }
    : undefined;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport,
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
