export function parsePositiveIntegerArg(
  args: string[],
  flag: string
): number | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  const raw = args[index + 1];
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${flag} deve receber um número inteiro positivo.`);
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${flag} excede o maior inteiro seguro.`);
  }

  return value;
}
