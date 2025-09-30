import chalk from "chalk";

export type JsonMode = "off" | "compact" | "pretty";

export function printHeading(label: string) {
  console.log(chalk.cyan.bold(`\n${label}\n${"-".repeat(label.length)}`));
}

export function printKeyValueTable(
  entries: Array<[string, string | number | null]>,
) {
  const labelWidth = entries.reduce(
    (acc, [label]) => Math.max(acc, label.length),
    0,
  );

  for (const [label, value] of entries) {
    const normalized =
      value === null || value === undefined || value === ""
        ? "–"
        : typeof value === "number"
          ? value.toString()
          : value;
    const padded = label.padEnd(labelWidth, " ");
    console.log(`${chalk.gray(padded)} : ${normalized}`);
  }
}

export function printJsonPayload(payload: unknown, mode: JsonMode) {
  if (mode === "off") {
    return;
  }

  const content =
    mode === "pretty"
      ? JSON.stringify(payload, null, 2)
      : JSON.stringify(payload);
  console.log(content);
}
