// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  buildReachabilitySummary,
  summarizeFindings,
  type GitleaksFinding,
} from '../../scripts/scan-secret-history';

const findings: GitleaksFinding[] = [
  { Commit: 'abc123', File: '.secrets.baseline', RuleID: 'generic-api-key' },
  { Commit: 'abc123', File: '.secrets.baseline', RuleID: 'generic-api-key' },
  { Commit: 'def456', File: 'docs/setup.md', RuleID: 'private-key' },
];

describe('scripts/scan-secret-history.ts', () => {
  it('resume achados sem expor valores de segredo', () => {
    expect(summarizeFindings(findings)).toEqual({
      findings: 3,
      commits: 2,
      rules: ['generic-api-key', 'private-key'],
      files: ['.secrets.baseline', 'docs/setup.md'],
    });
  });

  it('classifica alcance por branch local, branch remoto e tag pública', () => {
    const reachability = buildReachabilitySummary(
      findings,
      new Map([
        [
          'abc123',
          [
            'refs/heads/main',
            'refs/remotes/origin/main',
            'refs/remotes/origin/HEAD',
            'refs/tags/v1.0.0',
          ],
        ],
        ['def456', ['refs/heads/backup-before-squash']],
      ])
    );

    expect(reachability).toEqual([
      {
        commit: 'abc123',
        findings: 2,
        rules: ['generic-api-key'],
        files: ['.secrets.baseline'],
        localBranches: ['main'],
        remoteBranches: ['origin/main'],
        tags: ['v1.0.0'],
        publicRefCount: 2,
      },
      {
        commit: 'def456',
        findings: 1,
        rules: ['private-key'],
        files: ['docs/setup.md'],
        localBranches: ['backup-before-squash'],
        remoteBranches: [],
        tags: [],
        publicRefCount: 0,
      },
    ]);
  });
});
