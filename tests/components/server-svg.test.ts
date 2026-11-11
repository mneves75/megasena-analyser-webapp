import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * React streams a large page in pieces. A piece that starts inside an <svg> is
 * sent as `<svg style="display:none">`, which the CSP refuses. A server
 * component therefore never renders an SVG with element children: its shapes
 * go in as one markup string (components/figures.tsx), and icons that are
 * plain components (lucide) stay in client components. Image-response files
 * render to PNG, not HTML, so they are exempt.
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

const imageResponseFile = (file: string): boolean =>
  /(^|\/)(opengraph-image|twitter-image|icon|apple-icon)\.tsx$/.test(file) ||
  file === path.join('app', '_lib', 'brand-image.tsx');

const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const isClientModule = (source: string): boolean =>
  /^\s*(['"])use client\1/.test(withoutComments(source));

const serverModules = [...sources('app'), ...sources('components')].filter(
  (file) => !imageResponseFile(file) && !isClientModule(read(file))
);

/** Each `<svg` JSX element from its opening to its self-closing end or `</svg>`. */
function svgElements(source: string): string[] {
  const code = withoutComments(source);
  const elements: string[] = [];
  let at = code.search(/<svg\b/);
  while (at !== -1) {
    const rest = code.slice(at);
    const selfClose = rest.indexOf('/>');
    const close = rest.indexOf('</svg>');
    const end = close !== -1 && (selfClose === -1 || close < selfClose) ? close + 6 : selfClose + 2;
    elements.push(rest.slice(0, end));
    const next = rest.slice(end).search(/<svg\b/);
    at = next === -1 ? -1 : at + end + next;
  }
  return elements;
}

describe('SVG in server components', () => {
  it('finds the server modules it guards', () => {
    expect(serverModules).toContain(path.join('components', 'figures.tsx'));
    expect(serverModules).not.toContain(path.join('components', 'storage-disclosure.tsx'));
  });

  it('no server module imports lucide-react (its icons render <path> children)', () => {
    const offenders = serverModules.filter((file) =>
      /from\s+['"]lucide-react['"]/.test(read(file))
    );
    expect(offenders).toEqual([]);
  });

  it('every <svg> in a server module takes its shapes through dangerouslySetInnerHTML', () => {
    const offenders = serverModules.flatMap((file) =>
      svgElements(read(file))
        .filter(
          (element) => !element.includes('dangerouslySetInnerHTML') || element.includes('</svg>')
        )
        .map((element) => `${file}: ${element.slice(0, 60)}`)
    );
    expect(offenders).toEqual([]);
  });
});
