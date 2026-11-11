import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * One page shell: a single `page` utility sets the width and side gutter, and
 * every surface that draws a left edge (header, storage band, page content,
 * footer) uses it, so the brand, the page title and the footer text line up at
 * every width. jsdom has no layout, so these are source-level contracts; the
 * measured alignment is checked on the rendered site.
 */
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

describe('page shell', () => {
  it('defines one `page` utility: centred, full width, 72rem, 1rem gutter', () => {
    const block = read('app/globals.css').match(/@utility page \{([^}]*)\}/)?.[1] ?? '';
    expect(block).toMatch(/max-width:\s*72rem/);
    expect(block).toMatch(/padding-inline:\s*1rem/);
    expect(block).toMatch(/margin-inline:\s*auto/);
    expect(block).toMatch(/width:\s*100%/);
  });

  it('the shell sits on <main> itself, with its vertical padding and no inner wrapper', () => {
    const layout = read('app/layout.tsx');
    expect(layout).toMatch(/<main\s+id="main-content"\s+className="page [^"]*\bp[tb]-\d+[^"]*"/);
    expect(layout).not.toMatch(/<div className="page/);
  });

  it('the skip link shows the shared focus ring and moves focus into <main>', () => {
    const layout = read('app/layout.tsx');
    const link = layout.match(/<a\s+href="#main-content"\s+className="([^"]*)"/)?.[1];
    expect(link).toBeDefined();
    expect(link).toMatch(/\bsr-only\b/);
    expect(link).toMatch(/\bfocus:not-sr-only\b/);
    expect(link).toMatch(/(^|\s)focus-ring(\s|$)/);
    expect(link).not.toMatch(/outline-none/);

    // A fragment link focuses its target only if the target can take focus.
    const main = layout.match(/<main\b[^>]*>/)?.[0] ?? '';
    expect(main).toMatch(/\btabIndex=\{-1\}/);
    // Programmatic focus on <main> (not a tab stop) draws no ring.
    expect(main).toMatch(/className="[^"]*\bfocus:outline-none\b[^"]*"/);
  });

  it('the storage band sits between the header and <main>, outside the page content', () => {
    const layout = read('app/layout.tsx');
    const header = layout.indexOf('<SiteHeader />');
    const band = layout.indexOf('<StorageDisclosure />');
    const main = layout.indexOf('<main');
    expect(header).toBeGreaterThan(-1);
    expect(band).toBeGreaterThan(header);
    expect(main).toBeGreaterThan(band);
  });

  it.each([
    'components/site-header.tsx',
    'components/footer.tsx',
    'components/storage-disclosure.tsx',
  ])('%s aligns to the same shell', (file) => {
    expect(read(file)).toMatch(/className="page[ "]/);
  });

  it('no page, loading or error file types its own container', () => {
    const offenders = uiFiles.filter((file) => /className="[^"]*\bcontainer\b/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('long text uses one reading measure, 68ch', () => {
    const offenders = uiFiles.filter((file) =>
      /max-w-\[(?!68ch\])\d+ch\]|max-w-prose/.test(read(file))
    );
    expect(offenders).toEqual([]);
  });

  it('sections follow one rhythm, space-y-16 then lg:space-y-20', () => {
    const offenders = sources('app').filter((file) => /\bspace-y-1[24]\b/.test(read(file)));
    expect(offenders).toEqual([]);
    expect(read('app/dashboard/page.tsx')).toContain('space-y-16 lg:space-y-20');
  });

  it.each(['app/dashboard/page.tsx', 'app/resultados/page.tsx', 'app/mega-da-virada/page.tsx'])(
    '%s sets its header and first figure as one opening, not two sections apart',
    (file) => {
      const source = read(file);
      const opening = source.match(
        /<div className="space-y-8">\s*<header[\s\S]*?\n {6}<\/div>/
      )?.[0];
      expect(opening).toBeDefined();
      expect(opening).toContain('<LatestDrawFigure');
    }
  );
});
