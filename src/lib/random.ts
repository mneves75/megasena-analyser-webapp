const UINT32_MAX = 0xffffffff;

export type Prng = () => number;

export function hashSeed(input: string | number): number {
  let value = 0;
  const str = String(input);
  for (let i = 0; i < str.length; i += 1) {
    value = Math.imul(31, value) + str.charCodeAt(i);
    value |= 0; // force int32 wrap
  }

  return value >>> 0 || 1;
}

export function mulberry32(seed: string | number): Prng {
  let state = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);

  return function next() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / (UINT32_MAX + 1);
  };
}

export function randomInt(prng: Prng, min: number, max: number): number {
  const span = max - min + 1;
  return Math.floor(prng() * span) + min;
}

export function shuffle<T>(items: readonly T[], prng: Prng): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(prng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function sampleUniqueIntegers(
  prng: Prng,
  { min, max, count }: { min: number; max: number; count: number },
): number[] {
  if (count > max - min + 1) {
    throw new Error("Cannot sample more unique numbers than the range size");
  }

  const pool: number[] = [];
  for (let value = min; value <= max; value += 1) {
    pool.push(value);
  }

  const shuffled = shuffle(pool, prng);
  return shuffled.slice(0, count).sort((a, b) => a - b);
}

export function weightedPick<T>(
  items: readonly T[],
  weights: readonly number[],
  prng: Prng,
): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty list");
  }

  const normalized = weights.map((weight) => Math.max(weight, 0));
  const total = normalized.reduce((sum, weight) => sum + weight, 0);

  if (total === 0) {
    const index = randomInt(prng, 0, items.length - 1);
    return items[index];
  }

  const threshold = prng() * total;
  let cumulative = 0;

  for (let i = 0; i < items.length; i += 1) {
    cumulative += normalized[i];
    if (threshold <= cumulative) {
      return items[i];
    }
  }

  return items[items.length - 1];
}
