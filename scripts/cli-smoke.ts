import { spawn } from "node:child_process";
import process from "node:process";

const COMMANDS: Array<{
  title: string;
  args: string[];
}> = [
  {
    title: "summary",
    args: ["summary", "--json"],
  },
  {
    title: "stats frequencies",
    args: ["stats", "frequencies", "--limit", "3", "--json"],
  },
  {
    title: "bets generate",
    args: [
      "bets",
      "generate",
      "--budget",
      "10",
      "--seed",
      "SMOKE-SEED",
      "--strategy",
      "balanced",
      "--dry-run",
      "--json",
    ],
  },
  {
    title: "bets list",
    args: ["bets", "list", "--limit", "5", "--json"],
  },
  {
    title: "sync",
    args: ["sync", "--limit", "5", "--json"],
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL deve estar definido para executar o smoke test do CLI.",
    );
  }

  for (const command of COMMANDS) {
    await runCli(command.title, command.args);
  }

  console.log("CLI smoke test concluído com sucesso.");
}

function runCli(label: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    console.log(
      `\n[cli-smoke] Executando '${label}' → megasena ${args.join(" ")}`,
    );

    const child = spawn("npm", ["run", "cli", "--", ...args], {
      stdio: "inherit",
      env: {
        ...process.env,
        CI: process.env.CI ?? "1",
      },
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Comando '${label}' falhou com código ${code}`));
      }
    });
  });
}

main().catch((error) => {
  console.error(
    "[cli-smoke] Falha:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
