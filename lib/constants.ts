// Application Information
export const APP_INFO = {
  NAME: 'Mega-Sena Analyser',
  VERSION: '1.0.0',
  BUILD_DATE: '2025-09-30',
  DESCRIPTION: 'Análise estatística e gerador inteligente de apostas',
  REPOSITORY: 'https://github.com/megasena-analyser',
  AUTHOR: 'Mega-Sena Analyser Team',
} as const;

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
  REQUEST_TIMEOUT: 30000, // 30 seconds (increased from 10s for slow responses)
  RATE_LIMIT_DELAY: 1000, // Base delay between requests
  MAX_RETRIES: 5, // Maximum retry attempts (increased from 3)
  BACKOFF_MULTIPLIER: 2, // Exponential backoff multiplier
  PROGRESSIVE_DELAY_THRESHOLD: 50, // Start progressive delays after N requests
  PROGRESSIVE_DELAY_INCREMENT: 500, // Add 500ms every N requests
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

// Bet Generation Algorithm Constants
export const BET_ALLOCATION = {
  MIXED_MULTIPLE_PERCENTAGE: 0.6, // 60% for multiple bets in mixed mode
  BALANCED_HOT_PERCENTAGE: 0.5, // 50% hot numbers in balanced strategy
} as const;

// Statistics Display Constants
export const STATISTICS_DISPLAY = {
  TOP_NUMBERS_COUNT: 20, // Top N hot/cold numbers to display
  DASHBOARD_TOP_COUNT: 10, // Top N for dashboard overview
  RECENT_DRAWS_DEFAULT: 50, // Default number of recent draws to fetch
  PATTERNS_MIN_OCCURRENCES: 1, // Minimum occurrences to show pattern
} as const;

