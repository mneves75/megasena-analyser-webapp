import cliProgress from "cli-progress";
import { Ora, oraPromise } from "ora";
import chalk from "chalk";

export class SyncConsoleUI {
  private mainProgress: cliProgress.SingleBar | null = null;
  private currentSpinner: Ora | null = null;
  private isVerbose: boolean;

  constructor(verbose = false) {
    this.isVerbose = verbose;
  }

  showHeader() {
    console.log(chalk.cyan.bold("🎲 Mega-Sena Sync"));
    console.log(chalk.gray("Sincronização com dados oficiais CAIXA\n"));
  }

  showSyncPlan(options: {
    startConcurso: number;
    latestConcurso: number;
    totalToProcess: number;
    fullBackfill: boolean;
    limit?: number;
  }) {
    console.log(chalk.yellow("📋 Plano de Sincronização:"));
    console.log(
      `   Concurso inicial: ${chalk.white.bold(options.startConcurso)}`,
    );
    console.log(
      `   Concurso final: ${chalk.white.bold(options.latestConcurso)}`,
    );
    console.log(
      `   Total a processar: ${chalk.white.bold(options.totalToProcess)}`,
    );

    if (options.fullBackfill) {
      console.log(
        `   Modo: ${chalk.magenta("Full Backfill")} ${options.limit ? `(limitado a ${options.limit})` : ""}`,
      );
    }
    console.log();
  }

  async withSpinner<T>(text: string, promise: Promise<T>): Promise<T> {
    return oraPromise(promise, {
      text,
      successText: () => `${chalk.green("✓")} ${text}`,
      failText: () => `${chalk.red("✗")} ${text}`,
    });
  }

  startProgress(total: number) {
    this.mainProgress = new cliProgress.SingleBar({
      format:
        chalk.cyan("Processando") +
        " |" +
        chalk.cyan("{bar}") +
        "| {percentage}% | {value}/{total} concursos | ETA: {eta}s | Último: {lastConcurso}",
      barCompleteChar: "█",
      barIncompleteChar: "░",
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: false,
    });

    this.mainProgress.start(total, 0, {
      lastConcurso: "-",
    });
  }

  updateProgress(
    current: number,
    concurso: number,
    action: "inserted" | "updated",
  ) {
    if (this.mainProgress) {
      const actionSymbol = action === "inserted" ? "+" : "↻";
      this.mainProgress.update(current, {
        lastConcurso: `${actionSymbol}${concurso}`,
      });
    }
  }

  stopProgress() {
    if (this.mainProgress) {
      this.mainProgress.stop();
      this.mainProgress = null;
    }
  }

  showResults(results: {
    processed: number;
    inserted: number;
    updated: number;
    durationSeconds: number;
    avgTimePerConcurso: string;
  }) {
    console.log();
    console.log(chalk.green.bold("✅ Sincronização Concluída!"));
    console.log();

    // Results box
    const resultLines = [
      `📊 Resultados:`,
      `   Processados: ${chalk.white.bold(results.processed)} concursos`,
      `   Novos: ${chalk.green.bold(results.inserted)} inseridos`,
      `   Atualizados: ${chalk.blue.bold(results.updated)} modificados`,
      ``,
      `⏱️  Performance:`,
      `   Tempo total: ${chalk.white.bold(results.durationSeconds)}s`,
      `   Média por concurso: ${chalk.white.bold(results.avgTimePerConcurso)}`,
    ];

    const maxLength = Math.max(
      ...resultLines.map((line) => this.stripAnsi(line).length),
    );
    const boxWidth = maxLength + 4;

    console.log(chalk.gray("┌" + "─".repeat(boxWidth - 2) + "┐"));
    for (const line of resultLines) {
      const padding = " ".repeat(boxWidth - 4 - this.stripAnsi(line).length);
      console.log(chalk.gray("│ ") + line + padding + chalk.gray(" │"));
    }
    console.log(chalk.gray("└" + "─".repeat(boxWidth - 2) + "┘"));
    console.log();
  }

  showNoNewContests() {
    console.log(chalk.yellow("ℹ️  Nenhum concurso novo disponível"));
    console.log(chalk.gray("   O banco já está atualizado\n"));
  }

  showError(error: Error) {
    console.log(chalk.red.bold("❌ Erro na sincronização:"));
    console.log(chalk.red(`   ${error.message}\n`));
  }

  showAPIRetry(concurso: number, attempt: number, delay: number) {
    if (this.isVerbose) {
      console.log(
        chalk.yellow(
          `   ⚠️  API retry para concurso ${concurso} (tentativa ${attempt}, aguardando ${delay}ms)`,
        ),
      );
    }
  }

  private stripAnsi(text: string): string {
    // Simple ANSI escape sequence removal for length calculation
    return text.replace(/\u001b\[[0-9;]*m/g, "");
  }
}

export class SilentSyncUI extends SyncConsoleUI {
  private readonly verbose: boolean;

  constructor(verbose = false) {
    super(false);
    this.verbose = verbose;
  }

  showHeader() {
    if (this.verbose) {
      console.log("Iniciando sincronização Mega-Sena (modo simplificado)");
    }
  }

  showSyncPlan(options: {
    startConcurso: number;
    latestConcurso: number;
    totalToProcess: number;
    fullBackfill: boolean;
    limit?: number;
  }) {
    if (this.verbose) {
      const mode = options.fullBackfill
        ? `full-backfill${options.limit ? ` (limit ${options.limit})` : ""}`
        : "incremental";
      console.log(
        `[sync] concursos ${options.startConcurso}→${options.latestConcurso} (${options.totalToProcess}) – ${mode}`,
      );
    }
  }

  async withSpinner<T>(text: string, promise: Promise<T>): Promise<T> {
    if (this.verbose) {
      console.log(`[sync] ${text}`);
    }
    try {
      return await promise;
    } catch (error) {
      if (this.verbose) {
        console.error(
          `[sync] falha em ${text}:`,
          error instanceof Error ? error.message : error,
        );
      }
      throw error;
    }
  }

  startProgress() {}

  updateProgress() {}

  stopProgress() {}

  showResults(results: {
    processed: number;
    inserted: number;
    updated: number;
    durationSeconds: number;
    avgTimePerConcurso: string;
  }) {
    console.log(
      `Sync Mega-Sena concluído: ${results.processed} concursos processados (${results.inserted} inseridos, ${results.updated} atualizados). Tempo total ${results.durationSeconds}s, média ${results.avgTimePerConcurso}.`,
    );
  }

  showNoNewContests() {
    console.log("Sync Mega-Sena: nenhuma atualização necessária.");
  }

  showError(error: Error) {
    console.error("Sync Mega-Sena falhou:", error.message);
  }
}

// Factory for console UI - detects if we should show rich UI
export function createSyncUI(
  options: { verbose?: boolean; pretty?: boolean } = {},
): SyncConsoleUI {
  const shouldShowRich = !process.env.CI && process.stdout.isTTY;

  if (!shouldShowRich) {
    return new SilentSyncUI(options.verbose);
  }

  return new SyncConsoleUI(options.verbose);
}
