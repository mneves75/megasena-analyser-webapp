import pino from "pino";

const enablePrettyTransport =
  process.env.NODE_ENV !== "production" &&
  process.env.LOG_PRETTY === "1" &&
  !isNextManagedRuntime();

const transport = enablePrettyTransport
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

function isNextManagedRuntime(): boolean {
  return Boolean(
    process.env.NEXT_RUNTIME ||
      process.env.__NEXT_PRIVATE_PREBUNDLED_REACT ||
      process.env.TURBOPACK,
  );
}
