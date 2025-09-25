// Register server-only stub before loading server-only modules used by CLI commands.
import "./dev/register-server-only-stub.js";

import process from "node:process";

import { Command } from "commander";
import packageJson from "../package.json" assert { type: "json" };

import { logger } from "@/lib/logger";
import { registerSummaryCommand } from "@/cli/commands/summary";
import { registerStatsCommand } from "@/cli/commands/stats";
import { registerSyncCommand } from "@/cli/commands/sync";
import { registerBetsCommand } from "@/cli/commands/bets";
import { registerLimitsCommand } from "@/cli/commands/limits";

const program = new Command();

program
  .name("megasena")
  .description("CLI companion for Mega-Sena Analyzer")
  .version(packageJson.version ?? "0.0.0");

registerSummaryCommand(program);
registerStatsCommand(program);
registerSyncCommand(program);
registerBetsCommand(program);
registerLimitsCommand(program);

program.hook("postAction", () => {
  // Hook reserved for future resource cleanup once context helpers are wired in.
  logger.debug("CLI command finished execution");
});

async function main() {
  try {
    await program.parseAsync(process.argv);
    process.exitCode = process.exitCode ?? 0;
  } catch (error) {
    handleCliError(error);
  }
}

function handleCliError(error: unknown) {
  if (error instanceof Error) {
    logger.error({ err: error }, "CLI execution failed");
  } else {
    logger.error({ err: error }, "CLI execution failed with non-error value");
  }
  process.exit(
    process.exitCode && process.exitCode !== 0 ? process.exitCode : 1,
  );
}

process.on("unhandledRejection", (reason) => {
  handleCliError(reason);
});

process.on("uncaughtException", (error) => {
  handleCliError(error);
});

void main();
