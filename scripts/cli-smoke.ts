import { spawn } from "node:child_process";
import process from "node:process";

const COMMANDS = [
  { title: "summary", args: ["summary", "--json"] },
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
      "--json",
    ],
  },
  { title: "bets list", args: ["bets", "list", "--limit", "5", "--json"] },
  { title: "sync", args: ["sync", "--limit", "5", "--json"] },
] as const;

type CliCommand = (typeof COMMANDS)[number];

type SummaryPayload = {
  totalDraws?: number;
};

async function main() {
  const rawArgs = process.argv.slice(2);
  const shouldPrepare = rawArgs.includes("--prepare");

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL deve estar definido (ex.: file:./dev.db) para executar o smoke do CLI.",
    );
  }

  if (shouldPrepare) {
    console.log("[cli-smoke] Preparando banco: migrations + seed…");
    await runShell("npm", ["run", "db:migrate"], "db:migrate");
    await runShell("npm", ["run", "db:seed"], "db:seed");
  }

  await ensureDatabaseReady();

  for (const command of COMMANDS) {
    await runCli(command);
  }

  console.log("CLI smoke test concluído com sucesso.");
}

async function ensureDatabaseReady() {
  try {
    const summary = (await captureCliJson({
      title: "summary",
      args: ["summary", "--json"],
    })) as SummaryPayload;
    const totalDraws = Number(summary?.totalDraws ?? 0);
    if (!Number.isFinite(totalDraws) || totalDraws === 0) {
      throw new Error(
        "Nenhum concurso encontrado. Execute este script com '--prepare' ou rode 'npm run db:migrate && npm run db:seed' antes do smoke.",
      );
    }
  } catch (error) {
    throw new Error(
      `Falha ao ler dados do banco: ${(error as Error).message}. Sugestão: executar com '--prepare'.`,
    );
  }
}

function runCli(command: CliCommand) {
  return new Promise<void>((resolve, reject) => {
    console.log(
      `\n[cli-smoke] ${command.title} → megasena ${command.args.join(" ")}`,
    );

    const child = spawn("npm", ["run", "cli", "--", ...command.args], {
      stdio: "inherit",
      env: {
        ...process.env,
        CI: process.env.CI ?? "1",
      },
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`Comando '${command.title}' falhou com código ${code}`),
        );
      }
    });
  });
}

function runShell(command: string, args: string[], label: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env },
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Comando '${label}' falhou com código ${code}`));
      }
    });
  });
}

function captureCliJson(command: CliCommand) {
  return new Promise<unknown>((resolve, reject) => {
    const child = spawn("npm", ["run", "cli", "--", ...command.args], {
      stdio: ["inherit", "pipe", "inherit"],
      env: {
        ...process.env,
        CI: process.env.CI ?? "1",
      },
    });

    let raw = "";
    child.stdout?.on("data", (chunk) => {
      raw += chunk.toString();
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(
          new Error(`Comando '${command.title}' falhou com código ${code}`),
        );
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
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
