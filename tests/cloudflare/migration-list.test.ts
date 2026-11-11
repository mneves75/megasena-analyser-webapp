import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const source = readFileSync(path.join(root, 'cloudflare/data-object.ts'), 'utf8');

describe('Durable Object migration list', () => {
  it('names every db/migrations/*.sql file, in order, each paired with its own import', () => {
    const files = readdirSync(path.join(root, 'db/migrations')).filter(name => name.endsWith('.sql')).sort();
    const imports = new Map(
      [...source.matchAll(/^import (\w+) from '\.\.\/db\/migrations\/([^']+\.sql)\?raw';$/gm)]
        .map(([, identifier, file]) => [identifier, file])
    );
    const list = source.match(/const migrations = \[([\s\S]*?)\] as const;/)?.[1] ?? '';
    const entries = [...list.matchAll(/\['([^']+)', (\w+)\]/g)].map(([, name, identifier]) => ({ name, identifier }));

    expect(entries.map(entry => entry.name)).toEqual(files);
    expect([...imports.values()].sort()).toEqual(files);
    for (const entry of entries) expect(imports.get(entry.identifier)).toBe(entry.name);
  });
});
