import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string): string => readFileSync(path.join(root, file), 'utf8');

function sources(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((entry) => {
    const relative = path.join(dir, entry);
    if (statSync(path.join(root, relative)).isDirectory()) {
      return sources(relative);
    }
    return /\.tsx?$/.test(entry) ? [relative] : [];
  });
}

const uiFiles = [...sources('app'), ...sources('components')];

describe('design-system leftovers', () => {
  it('focus rings come from the shared utilities, not hand-typed class strings', () => {
    const css = read('app/globals.css');
    expect(css).toMatch(/@utility focus-ring \{/);
    expect(css).toMatch(/@utility focus-ring-inset \{/);
    const offenders = uiFiles.filter((file) =>
      read(file).includes('focus-visible:outline-none focus-visible:ring-2')
    );
    expect(offenders).toEqual([]);
  });

  it('Button keeps only the variants in use: default, outline, ghost', () => {
    const source = read('components/ui/button.tsx');
    expect(source).not.toMatch(/\bsecondary:|\bdestructive:/);
  });

  it('only the easing in use is defined (out-quint)', () => {
    const css = read('app/globals.css');
    expect(css).not.toMatch(/--ease-out-cubic|--ease-in-out-cubic/);
    const config = read('tailwind.config.cjs');
    expect(config).not.toMatch(/'out-cubic'|'in-out-cubic'|\bsmooth:/);
  });

  it('the budget field owns its input and label (single caller, no wrapper modules)', () => {
    expect(existsSync(path.join(root, 'components/ui/input.tsx'))).toBe(false);
    expect(existsSync(path.join(root, 'components/ui/label.tsx'))).toBe(false);
  });
});
