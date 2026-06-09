export const MAX_TREND_NUMBERS = 60;
export const MAX_TREND_NUMBERS_PARAM_LENGTH = 180;

export type TrendNumbersParseResult =
  | { success: true; numbers: number[] }
  | { success: false; reason: 'too_many_numbers' | 'number_out_of_range' | 'invalid_number' };

export function parseTrendNumbers(numbersParam: string): TrendNumbersParseResult {
  const parts = numbersParam.split(',');

  if (parts.length > MAX_TREND_NUMBERS) {
    return { success: false, reason: 'too_many_numbers' };
  }

  const numbers: number[] = [];
  for (const part of parts) {
    const value = Number(part);
    if (!Number.isInteger(value)) {
      return { success: false, reason: 'invalid_number' };
    }
    if (value < 1 || value > 60) {
      return { success: false, reason: 'number_out_of_range' };
    }
    numbers.push(value);
  }

  return { success: true, numbers: Array.from(new Set(numbers)) };
}
