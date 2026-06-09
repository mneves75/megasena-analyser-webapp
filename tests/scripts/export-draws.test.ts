import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface DrawSeed {
  contest: number;
  date: string;
  numbers: number[];
  prizeSena: number | null;
  winnersSena: number;
  prizeQuina: number | null;
  winnersQuina: number;
  prizeQuadra: number | null;
  winnersQuadra: number;
  totalCollection: number | null;
  accumulated: boolean;
  accumulatedValue: number | null;
  nextEstimatedPrize: number | null;
  specialDraw: boolean;
}

const SEED_PATH = path.join(process.cwd(), 'db', 'seed', 'draws.json');
const rawSeed = readFileSync(SEED_PATH, 'utf8');
const seed = JSON.parse(rawSeed) as DrawSeed[];

const nullableNumbers = (draw: DrawSeed): Array<number | null> => [
  draw.prizeSena,
  draw.prizeQuina,
  draw.prizeQuadra,
  draw.totalCollection,
  draw.accumulatedValue,
  draw.nextEstimatedPrize,
];

describe('draws seed (db/seed/draws.json)', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(seed)).toBe(true);
    expect(seed.length).toBeGreaterThan(0);
  });

  it('covers contests contiguously from 1 with no gaps or duplicates', () => {
    seed.forEach((draw, index) => {
      expect(draw.contest).toBe(index + 1);
    });
    expect(seed.at(-1)?.contest).toBe(seed.length);
  });

  it('gives every draw six unique numbers within 1-60', () => {
    for (const draw of seed) {
      expect(draw.numbers).toHaveLength(6);
      for (const value of draw.numbers) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(60);
      }
      expect(new Set(draw.numbers).size).toBe(6);
    }
  });

  it('has DD/MM/YYYY dates and well-typed prize/winner fields', () => {
    const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
    for (const draw of seed) {
      expect(draw.date).toMatch(datePattern);

      for (const winners of [draw.winnersSena, draw.winnersQuina, draw.winnersQuadra]) {
        expect(Number.isInteger(winners)).toBe(true);
        expect(winners).toBeGreaterThanOrEqual(0);
      }

      for (const prize of nullableNumbers(draw)) {
        expect(prize === null || typeof prize === 'number').toBe(true);
      }

      expect(typeof draw.accumulated).toBe('boolean');
      expect(typeof draw.specialDraw).toBe('boolean');
    }
  });

  it('excludes telemetry and internal columns', () => {
    for (const forbidden of ['created_at', 'updated_at', 'user_agent', 'client_id', '"id"']) {
      expect(rawSeed).not.toContain(forbidden);
    }
  });
});
