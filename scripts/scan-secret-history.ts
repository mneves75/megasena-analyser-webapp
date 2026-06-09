#!/usr/bin/env bun

import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const GITLEAKS_IMAGE = 'ghcr.io/gitleaks/gitleaks:v8.30.1';
const REPORT_DIR = '.tmp';
const REPORT_FILE = 'gitleaks-history-redacted.json';

export type GitleaksFinding = {
  RuleID?: string;
  File?: string;
  Commit?: string;
};

type CommitReachability = {
  commit: string;
  findings: number;
  rules: string[];
  files: string[];
  localBranches: string[];
  remoteBranches: string[];
  tags: string[];
  publicRefCount: number;
};

function run(command: string[], cwd: string): { exitCode: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(command, { cwd, stdout: 'pipe', stderr: 'pipe' });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function requireSuccess(result: { exitCode: number; stderr: string }, label: string): void {
  if (result.exitCode !== 0) {
    throw new Error(`${label} falhou: ${result.stderr.trim()}`);
  }
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

export function summarizeFindings(findings: GitleaksFinding[]): {
  findings: number;
  commits: number;
  rules: string[];
  files: string[];
} {
  return {
    findings: findings.length,
    commits: unique(findings.map((finding) => finding.Commit)).length,
    rules: unique(findings.map((finding) => finding.RuleID)),
    files: unique(findings.map((finding) => finding.File)),
  };
}

function shortRef(ref: string, prefix: string): string {
  return ref.startsWith(prefix) ? ref.slice(prefix.length) : ref;
}

function classifyRefs(refs: string[]): Pick<
  CommitReachability,
  'localBranches' | 'remoteBranches' | 'tags' | 'publicRefCount'
> {
  const localBranches = unique(
    refs
      .filter((ref) => ref.startsWith('refs/heads/'))
      .map((ref) => shortRef(ref, 'refs/heads/'))
  );
  const remoteBranches = unique(
    refs
      .filter((ref) => ref.startsWith('refs/remotes/'))
      .map((ref) => shortRef(ref, 'refs/remotes/'))
      .filter((ref) => !ref.endsWith('/HEAD'))
  );
  const tags = unique(
    refs.filter((ref) => ref.startsWith('refs/tags/')).map((ref) => shortRef(ref, 'refs/tags/'))
  );

  return {
    localBranches,
    remoteBranches,
    tags,
    publicRefCount: remoteBranches.length + tags.length,
  };
}

export function buildReachabilitySummary(
  findings: GitleaksFinding[],
  refsByCommit: Map<string, string[]>
): CommitReachability[] {
  return unique(findings.map((finding) => finding.Commit)).map((commit) => {
    const commitFindings = findings.filter((finding) => finding.Commit === commit);
    return {
      commit,
      findings: commitFindings.length,
      rules: unique(commitFindings.map((finding) => finding.RuleID)),
      files: unique(commitFindings.map((finding) => finding.File)),
      ...classifyRefs(refsByCommit.get(commit) ?? []),
    };
  });
}

function refsContainingCommit(repoRoot: string, commit: string): string[] {
  const result = run(
    ['git', 'for-each-ref', '--contains', commit, '--format=%(refname)', 'refs/heads', 'refs/remotes', 'refs/tags'],
    repoRoot
  );
  requireSuccess(result, `git for-each-ref ${commit}`);
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

async function main(): Promise<void> {
  const rootResult = run(['git', 'rev-parse', '--show-toplevel'], process.cwd());
  requireSuccess(rootResult, 'git rev-parse');

  const repoRoot = rootResult.stdout.trim();
  const reportDir = path.join(repoRoot, REPORT_DIR);
  const reportPath = path.join(reportDir, REPORT_FILE);
  await mkdir(reportDir, { recursive: true });

  const scan = Bun.spawnSync(
    [
      'docker',
      'run',
      '--rm',
      '-v',
      `${repoRoot}:/repo:ro`,
      '-v',
      `${reportDir}:/out`,
      GITLEAKS_IMAGE,
      'detect',
      '--source',
      '/repo',
      '--no-banner',
      '--redact',
      '--report-format',
      'json',
      '--report-path',
      `/out/${REPORT_FILE}`,
      '--exit-code',
      '0',
    ],
    { stdout: 'inherit', stderr: 'inherit' }
  );

  if (scan.exitCode !== 0) {
    process.exitCode = scan.exitCode;
    return;
  }

  const reportFile = Bun.file(reportPath);
  if (!(await reportFile.exists())) {
    throw new Error(`Relatório não foi gerado em ${reportPath}.`);
  }

  const reportText = await reportFile.text();
  const findings = reportText.trim().length > 0 ? (JSON.parse(reportText) as GitleaksFinding[]) : [];
  const refsByCommit = new Map(
    unique(findings.map((finding) => finding.Commit)).map((commit) => [
      commit,
      refsContainingCommit(repoRoot, commit),
    ])
  );
  const summary = {
    ...summarizeFindings(findings),
    reachability: buildReachabilitySummary(findings, refsByCommit),
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log(`Relatório redigido: ${path.relative(repoRoot, reportPath)}`);

  if (summary.findings > 0) {
    console.error(
      'Histórico Git contém possíveis segredos. Rotacione credenciais reais antes de rewrite/force-push.'
    );
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
