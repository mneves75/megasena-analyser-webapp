import { bindings, defineConfig, defineWorker, exports, triggers } from 'cf/config';
import pkg from './package.json' with { type: 'json' };
import siteDomains from './lib/site-domains.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const name = isProduction ? 'megasena-analyser' : 'megasena-analyser-staging';
  const allowedOrigins = process.env[isProduction
    ? 'CLOUDFLARE_PRODUCTION_ALLOWED_ORIGINS'
    : 'CLOUDFLARE_STAGING_ALLOWED_ORIGINS'];
  return {
  worker: defineWorker({
    name,
    // Apply only after the retained-data and rollback acceptance gates pass.
    ...(process.env['CLOUDFLARE_BIND_CUSTOM_DOMAINS'] === '1' ? {
      domains: isProduction ? [siteDomains.primaryDomain, ...siteDomains.redirectDomains] : [`staging.${siteDomains.primaryDomain}`],
    } : {}),
    entrypoint: './cloudflare/worker.ts',
    compatibilityDate: "2026-10-02",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
      DATA: bindings.durableObject({ worker: name, exportName: 'MegaSenaData' }),
      IP_HASH_SECRET: bindings.secret(),
      APP_VERSION: bindings.text(pkg.version),
      NODE_ENV: bindings.text('production'),
      ENVIRONMENT: bindings.text('production'),
      DEPLOYMENT_STAGE: bindings.text(isProduction ? 'production' : 'staging'),
      // An omitted production binding retains the API's canonical-origin default.
      ...(isProduction && allowedOrigins === undefined ? {} : {
        ALLOWED_ORIGINS: bindings.text(allowedOrigins ?? ''),
      }),
      BOOTSTRAP_PUBLIC_SEED: bindings.text('1'),
      AUDIT_RETENTION_DAYS: bindings.text(process.env[isProduction ? 'CLOUDFLARE_PRODUCTION_AUDIT_RETENTION_DAYS' : 'CLOUDFLARE_STAGING_AUDIT_RETENTION_DAYS'] ?? '400'),
      LOG_RETENTION_DAYS: bindings.text(process.env[isProduction ? 'CLOUDFLARE_PRODUCTION_LOG_RETENTION_DAYS' : 'CLOUDFLARE_STAGING_LOG_RETENTION_DAYS'] ?? '30'),
      TRUSTED_CLIENT_IP_HEADER: bindings.text('cf-connecting-ip'),
    },
    exports: { MegaSenaData: exports.durableObject({ storage: 'sqlite' }) },
    // 06:00 UTC = 03:00 em Brasília, após o processamento do concurso anterior.
    triggers: [triggers.scheduled({ schedule: '0 6 * * *' })],
    observability: { enabled: true },
  }),
  };
});
