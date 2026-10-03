import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// Failure modes: nested braces, parentheses, mixed or unmatched blocks, direct
// AST input, cyclic ASTs, and options attempting to bypass the fixed ceiling.
// Exercise the installed dependency, rather than a copy of the patch logic.
const require = createRequire(import.meta.url);
type Tree = { type: string; nodes?: Tree[]; value?: string; parent?: Tree };
type Braces = {
  (input: string, options?: Record<string, unknown>): string[];
  parse(input: string, options?: Record<string, unknown>): Tree;
  compile(input: string | Tree, options?: Record<string, unknown>): string;
  expand(input: string | Tree, options?: Record<string, unknown>): string[];
  stringify(input: string | Tree, options?: Record<string, unknown>): string;
};
const braces = require('braces') as Braces;
const methods = ['parse', 'compile', 'expand', 'stringify'] as const;
const patterns = [
  '{'.repeat(101) + 'a,b' + '}'.repeat(101),
  '('.repeat(101) + 'a' + ')'.repeat(101),
  '{('.repeat(51) + 'a,b' + ')}'.repeat(51),
  '{'.repeat(101) + 'a',
];

function nestedTree(depth: number): Tree {
  let tree: Tree = { type: 'text', value: 'x' };
  for (let index = 0; index < depth; index++) {
    tree = { type: 'paren', nodes: [tree] };
  }
  return { type: 'root', nodes: [tree] };
}

describe('installed braces stack-exhaustion mitigation', () => {
  it('uses the exact version covered by the local mitigation', () => {
    expect(require('braces/package.json').version).toBe('3.0.3');
  });
  for (const method of methods) {
    for (const [index, pattern] of patterns.entries()) {
      it(`${method} rejects excessive nesting pattern ${index}`, () => {
        expect(() => braces[method](pattern, { maxDepth: Infinity }))
          .toThrow(/maximum nesting depth/i);
      });
    }
  }

  for (const method of ['compile', 'expand', 'stringify'] as const) {
    it(`${method} rejects malformed scalar values before coercion`, () => {
      let value: unknown = 'x';
      for (let depth = 0; depth < 1000; depth++) value = [value];
      const tree = { type: 'root', nodes: [{ type: 'text', value }] };
      expect(() => braces[method](tree as Tree)).toThrow(/invalid syntax tree scalar/i);
      const cyclic: unknown[] = [];
      cyclic.push(cyclic);
      tree.nodes[0].value = cyclic;
      expect(() => braces[method](tree as Tree)).toThrow(/invalid syntax tree scalar/i);
    });
    it(`${method} rejects a direct deeply nested AST`, () => {
      expect(() => braces[method](nestedTree(101)))
        .toThrow(/maximum nesting depth/i);
    });
    it(`${method} rejects cyclic AST input`, () => {
      const tree: Tree = { type: 'root', nodes: [] };
      tree.nodes!.push(tree);
      expect(() => braces[method](tree)).toThrow(/cyclic syntax tree/i);
    });
    it(`${method} permits the nesting boundary`, () => {
      expect(() => braces[method](nestedTree(100))).not.toThrow();
    });
  }

  for (const method of ['compile', 'expand'] as const) {
    for (const field of ['commas', 'ranges'] as const) {
      it(`${method} rejects malformed ${field} before numeric coercion`, () => {
        const tree = {
          type: 'root', nodes: [{ type: 'brace', nodes: [], [field]: [[1]] }],
        };
        expect(() => braces[method](tree)).toThrow(/invalid syntax tree scalar/i);
      });
    }
  }

  it('rejects cyclic parent references before expansion', () => {
    const tree: Tree = { type: 'root', nodes: [] };
    tree.parent = tree;
    expect(() => braces.expand(tree)).toThrow(/invalid parent reference/i);
  });

  it('protects the default and expansion entry points', () => {
    expect(() => braces(patterns[0])).toThrow(/maximum nesting depth/i);
    expect(() => braces(patterns[1], { expand: true })).toThrow(/maximum nesting depth/i);
  });

  it('preserves ordinary glob, range, parentheses and literal handling', () => {
    expect(braces.expand('src/{app,lib}/file-{1..3}.ts')).toEqual([
      'src/app/file-1.ts', 'src/app/file-2.ts', 'src/app/file-3.ts',
      'src/lib/file-1.ts', 'src/lib/file-2.ts', 'src/lib/file-3.ts',
    ]);
    expect(braces.compile('src/{app,lib}/**/*.ts')).toBe('src/(app|lib)/**/*.ts');
    expect(braces.stringify('a/(b)/{c,d}')).toBe('a/(b)/{c,d}');
    expect(braces.expand('"' + '{'.repeat(101) + '"')).toEqual(['{'.repeat(101)]);
    expect(braces.expand('[' + '('.repeat(101) + ']')).toEqual(['[' + '('.repeat(101) + ']']);
    expect(braces.compile('('.repeat(100) + 'x' + ')'.repeat(100)))
      .toBe('('.repeat(100) + 'x' + ')'.repeat(100));
    expect(braces.stringify(braces.parse('foo/{a,b}/bar').nodes![2])).toBe('{a,b}');
    expect(braces.expand('a{b')).toEqual(['a{b']);
    expect(braces.stringify('a{b')).toBe('a{b');
  });
});
