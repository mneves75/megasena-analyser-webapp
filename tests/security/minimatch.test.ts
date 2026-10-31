import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// GHSA-g3hv-75wg-m249 lists minimatch <11.0.1, but the amplification lives in
// firstPhasePreProcess(), a v7+ optimizer whose `**/../` rewrite appends
// cloned globParts inside a fixpoint loop. The 3.x line installed here maps
// each brace-expanded pattern to exactly one globParts entry. These tests run
// against the installed copy, so a move to an affected major fails them.
const require = createRequire(import.meta.url);
type Minimatch = new (pattern: string, options?: Record<string, unknown>) => {
  globParts: string[][];
  set: unknown[][];
  match(path: string): boolean;
};
const minimatch = require('minimatch') as ((path: string, pattern: string) => boolean) & {
  Minimatch: Minimatch;
};
const attack = (repeats: number) => `${'**/../'.repeat(repeats)}x`;

describe('installed minimatch and GHSA-g3hv-75wg-m249', () => {
  it('uses the exact 3.x version the audit exception covers', () => {
    expect(require('minimatch/package.json').version).toBe('3.1.4');
  });

  it('ships no first-phase optimizer to amplify', () => {
    const source = readFileSync(require.resolve('minimatch'), 'utf8');
    for (const marker of ['firstPhasePreProcess', 'secondPhasePreProcess', 'optimizationLevel', 'partsMatch']) {
      expect(source).not.toContain(marker);
    }
  });

  it('keeps one globParts entry per attack pattern, at any length and option', () => {
    for (const repeats of [1, 50, 2000]) {
      const parsed = new minimatch.Minimatch(attack(repeats), { optimizationLevel: 2 });
      expect(parsed.globParts).toHaveLength(1);
      expect(parsed.set).toHaveLength(1);
      expect(parsed.globParts[0]).toHaveLength(repeats * 2 + 1);
    }
  });

  it('positive control: brace expansion still grows the set, and globs still match', () => {
    expect(new minimatch.Minimatch('{a,b,c}/**/*.ts').globParts).toHaveLength(3);
    expect(minimatch('src/lib/a.ts', 'src/**/*.ts')).toBe(true);
    expect(minimatch('src/lib/a.js', 'src/**/*.ts')).toBe(false);
  });
});
