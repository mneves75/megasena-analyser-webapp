import { bindings, defineConfig, defineWorker, exports } from 'cf/config';
import siteDomains from '../../lib/site-domains.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  if (mode !== 'staging-off') throw new Error('Use somente o modo staging-off nesta unidade.');
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID']?.trim();
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID explícito é obrigatório.');

  return {
    accountId,
    worker: defineWorker({
      name: 'megasena-analyser-staging',
      domains: [`staging.${siteDomains.primaryDomain}`],
      entrypoint: './worker.ts',
      compatibilityDate: '2026-10-02',
      env: { IP_HASH_SECRET: bindings.secret() },
      exports: { MegaSenaData: exports.durableObject({ state: 'deleted' }) },
      triggers: [],
      observability: { enabled: true },
    }),
  };
});
