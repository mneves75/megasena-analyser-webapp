// @vitest-environment node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function read(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

function jobBlock(workflow: string, jobName: string): string {
  const marker = `\n  ${jobName}:\n`;
  const start = workflow.indexOf(marker);
  expect(start, `job ${jobName} ausente do workflow`).toBeGreaterThanOrEqual(0);

  const contentStart = start + marker.length;
  const nextJob = workflow.slice(contentStart).search(/\n  [a-z][a-z0-9-]*:\n/);
  const end = nextJob === -1 ? workflow.length : contentStart + nextJob;
  return workflow.slice(start + 1, end);
}

describe('controles de supply chain', () => {
  it('só publica as tags Docker depois de escanear o digest construído', async () => {
    const workflow = await read('.github/workflows/ci-cd.yml');
    const buildJob = jobBlock(workflow, 'build');
    const securityJob = jobBlock(workflow, 'security');
    const publishJob = jobBlock(workflow, 'publish');
    const imageBuildStep = buildJob.slice(
      buildJob.indexOf('- name: Build Docker image by digest'),
      buildJob.indexOf('- name: Image digest')
    );

    expect(buildJob).toContain('digest: ${{ steps.build-push.outputs.digest }}');
    expect(buildJob).toContain('push-by-digest=true');
    expect(buildJob).toContain('name-canonical=true');
    expect(imageBuildStep).not.toContain('push: ${{ github.event_name !=');
    expect(imageBuildStep).not.toContain('tags: ${{ steps.meta.outputs.tags }}');

    expect(securityJob).toContain(
      'image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}@${{ needs.build.outputs.digest }}'
    );
    expect(securityJob).toContain("exit-code: '1'");
    expect(securityJob).not.toContain(':latest');

    expect(publishJob).toContain('needs: [build, security]');
    expect(publishJob).toContain('docker buildx imagetools create');
    expect(publishJob).toContain('IMAGE_DIGEST: ${{ needs.build.outputs.digest }}');
  });

  it('executa somente o React Doctor instalado pelo lockfile', async () => {
    const packageJson = JSON.parse(await read('package.json')) as {
      scripts: Record<string, string>;
    };
    const hook = await read('.githooks/pre-commit');

    expect(packageJson.scripts['doctor']).toBe('./node_modules/.bin/react-doctor');
    expect(hook).toContain('./node_modules/.bin/react-doctor');
    expect(hook).toContain('pnpm install --frozen-lockfile');
    expect(hook).not.toContain('react-doctor@latest');
    expect(hook).not.toContain('pnpm dlx');
    expect(hook).not.toContain('npx ');
    expect(hook).not.toContain('command -v react-doctor');
  });

  it('fixa os dois scanners Gitleaks pelo mesmo digest e remove sua rede', async () => {
    const pinModule = await read('scripts/security-tool-images.ts');
    const workingTreeScanner = await read('scripts/scan-secrets.ts');
    const historyScanner = await read('scripts/scan-secret-history.ts');
    const expectedImage =
      'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';

    expect(pinModule).toContain('export const GITLEAKS_IMAGE =');
    expect(pinModule).toContain(`'${expectedImage}'`);

    for (const scanner of [workingTreeScanner, historyScanner]) {
      expect(scanner).toContain("import { GITLEAKS_IMAGE } from './security-tool-images';");
      expect(scanner).toContain("'--network=none'");
      expect(scanner).not.toContain("const GITLEAKS_IMAGE = '");
    }
  });

  it('mantém a regra ast-grep de imagem mutável no pre-commit', async () => {
    const packageJson = JSON.parse(await read('package.json')) as {
      scripts: Record<string, string>;
    };
    const config = await read('sgconfig.yml');
    const rule = await read('ast-grep-rules/no-mutable-gitleaks-image.yml');
    const hook = await read('.githooks/pre-commit');

    expect(config).toContain('ruleDirs:');
    expect(config).toContain('- ast-grep-rules');
    expect(rule).toContain('id: no-mutable-gitleaks-image');
    expect(rule).toContain('severity: error');
    expect(packageJson.scripts['lint:ast']).toBe('ast-grep scan --config sgconfig.yml');
    expect(hook).toContain('"./node_modules/.bin/ast-grep" scan --config sgconfig.yml');
  });

  it('usa a interface staged atual do Gitleaks no pre-commit', async () => {
    const hook = await read('.githooks/pre-commit');

    expect(hook).toContain('gitleaks git --staged --redact');
    expect(hook).not.toContain('gitleaks protect');
  });
});
