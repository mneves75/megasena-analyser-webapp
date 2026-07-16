import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Rounds a number to a specified number of decimal places
 * @param value The number to round
 * @param decimals Number of decimal places (default: 2)
 * @returns Rounded number
 * @example
 * roundTo(3.14159, 2) // 3.14
 * roundTo(42.999, 0) // 43
 */
export function roundTo(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function parseIsoDate(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error(`Invalid draw date: ${date}`);
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid draw date: ${date}`);
  }

  return parsed;
}

export function toIsoDate(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    parseIsoDate(date);
    return date;
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
  if (!match) {
    throw new Error(`Invalid draw date: ${date}`);
  }

  const [, day, month, year] = match;
  const isoDate = `${year}-${month}-${day}`;
  parseIsoDate(isoDate);
  return isoDate;
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseIsoDate(date));
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}
