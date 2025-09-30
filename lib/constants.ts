// Mega-Sena Game Constants
export const MEGASENA_CONSTANTS = {
  MIN_NUMBER: 1,
  MAX_NUMBER: 60,
  NUMBERS_PER_BET: 6,
  MIN_NUMBERS_MULTIPLE: 6,
  MAX_NUMBERS_MULTIPLE: 20,
} as const;

// Bet Prices (as of July 2025 - Official CAIXA values after 20% increase)
// Source: https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx
export const BET_PRICES: Record<number, number> = {
  6: 6.0,
  7: 42.0,
  8: 168.0,
  9: 504.0,
  10: 1260.0,
  11: 2772.0,
  12: 5544.0,
  13: 10296.0,
  14: 18018.0,
  15: 30030.0,
  // Extended values (16-20 are rarely used but included for completeness)
  16: 48048.0,
  17: 74256.0,
  18: 111384.0,
  19: 162792.0,
  20: 232560.0,
};

// API Configuration
export const API_CONFIG = {
  CAIXA_BASE_URL: 'https://servicebus2.caixa.gov.br/portaldeloterias/api',
  REQUEST_TIMEOUT: 10000,
  RATE_LIMIT_DELAY: 1000,
} as const;

// Prize Tiers
export const PRIZE_TIERS = {
  SENA: 6,
  QUINA: 5,
  QUADRA: 4,
} as const;

// Chart Colors
export const CHART_COLORS = {
  primary: 'hsl(var(--chart-1))',
  secondary: 'hsl(var(--chart-2))',
  tertiary: 'hsl(var(--chart-3))',
  quaternary: 'hsl(var(--chart-4))',
  quinary: 'hsl(var(--chart-5))',
} as const;

// Bet Generation Strategies
export const BET_GENERATION_MODE = {
  SIMPLE_ONLY: 'simple_only',
  MULTIPLE_ONLY: 'multiple_only',
  MIXED: 'mixed',
  OPTIMIZED: 'optimized',
} as const;

export type BetGenerationMode = (typeof BET_GENERATION_MODE)[keyof typeof BET_GENERATION_MODE];

// Budget Presets (R$)
export const BUDGET_PRESETS = [
  10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000,
] as const;

// Number of combinations per bet size
export const BET_COMBINATIONS: Record<number, number> = {
  6: 1,
  7: 7,
  8: 28,
  9: 84,
  10: 210,
  11: 462,
  12: 924,
  13: 1716,
  14: 3003,
  15: 5005,
} as const;

