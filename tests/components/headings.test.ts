import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Three heading levels with visible steps: the page title (PageTitle), the
 * section heading (SectionHeading) and the subsection (`text-lg font-semibold`).
 * Pages use the shared components instead of typing their own heading classes.
 */
const root = process.cwd();
const read = (file: string): string => readFileSync(path.join(root, file), 'utf8');

function sources(dir: string, pattern: RegExp): string[] {
  return readdirSync(path.join(root, dir)).flatMap((entry) => {
    const relative = path.join(dir, entry);
    if (statSync(path.join(root, relative)).isDirectory()) {
      return sources(relative, pattern);
    }
    return pattern.test(entry) ? [relative] : [];
  });
}

const pages = sources('app', /^page\.tsx$/);

describe('headings', () => {
  it('no file uses the redundant font-title family (same font as font-sans)', () => {
    const files = [
      ...sources('app', /\.(tsx?|css)$/),
      ...sources('components', /\.tsx?$/),
      'tailwind.config.cjs',
    ];
    expect(files.filter((file) => read(file).includes('font-title'))).toEqual([]);
  });

  it('every page title is a PageTitle', () => {
    expect(pages.filter((file) => /<h1[\s>]/.test(read(file)))).toEqual([]);
  });

  it('every visible section heading is a SectionHeading', () => {
    const offenders = pages.filter((file) =>
      [...read(file).matchAll(/<h2\s[^>]*className=\{?["'`]([^"'`]*)/g)].some(
        (match) => !match[1]?.includes('sr-only')
      )
    );
    expect(offenders).toEqual([]);
    // A heading class passed through a variable is a hand-typed heading too.
    expect(pages.filter((file) => /<h2[^>]*className=\{(?!["'`])/.test(read(file)))).toEqual([]);
  });

  it('every subsection is set at text-lg font-semibold', () => {
    const classes = sources('app', /\.tsx$/).flatMap((file) =>
      [...read(file).matchAll(/<h3\s[^>]*className="([^"]*)"/g)].map((match) => match[1])
    );
    expect(classes.length).toBeGreaterThan(0);
    expect(new Set(classes)).toEqual(new Set(['text-lg font-semibold']));
  });
});
