import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// APP_VERSION comes from package.json and keys the edge cache. A release that
// changes renderers without a new version keeps serving the previous HTML.
describe('release version', () => {
  it('matches the newest released CHANGELOG entry', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    const newest = readFileSync('CHANGELOG.md', 'utf8').match(/^## \[(\d+\.\d+\.\d+[^\]]*)\]/m)?.[1];
    expect(newest).toBeDefined();
    expect(version).toBe(newest);
  });
});
