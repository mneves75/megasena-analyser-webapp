import { MEGASENA_CONSTANTS } from '@/lib/constants';

export type MegaSenaNumberTuple = [number, number, number, number, number, number];

export function normalizeMegaSenaNumbers(values: readonly unknown[]): MegaSenaNumberTuple {
  const numbers = values.map((value) => {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return Number(value);
    }
    return Number.NaN;
  });

  if (numbers.length !== MEGASENA_CONSTANTS.NUMBERS_PER_BET) {
    throw new Error(
      `expected ${MEGASENA_CONSTANTS.NUMBERS_PER_BET} draw numbers, got ${numbers.length}`
    );
  }

  const invalid = numbers.find(
    (number) =>
      !Number.isInteger(number) ||
      number < MEGASENA_CONSTANTS.MIN_NUMBER ||
      number > MEGASENA_CONSTANTS.MAX_NUMBER
  );
  if (typeof invalid === 'number') {
    throw new Error(
      `draw numbers must be integers between ${MEGASENA_CONSTANTS.MIN_NUMBER} and ${MEGASENA_CONSTANTS.MAX_NUMBER}`
    );
  }

  const unique = new Set(numbers);
  if (unique.size !== MEGASENA_CONSTANTS.NUMBERS_PER_BET) {
    throw new Error('draw numbers must contain six unique values');
  }

  return [...numbers].sort((a, b) => a - b) as MegaSenaNumberTuple;
}
