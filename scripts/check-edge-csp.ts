#!/usr/bin/env bun

import { createHash } from 'node:crypto';
import { buildApiSecurityHeaders } from '../lib/security/csp';

type ResponseSnapshot = {
  url: string;
  status: number;
  headers: Headers;
  bodySnippet: string;
};

type EdgeCspOptions = {
  baseUrl: string;
  originBaseUrl?: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

type CspCheck = {
  ok: boolean;
  title: string;
  problems: string[];
  evidence: string[];
  actions?: string[];
};

type CspSummary = {
  digest: string;
  directives: string[];
  highlightedSources: string[];
};

type EdgeOverrideOwner =
  | 'shared_response_headers'
  | 'cloudflare_client_side_security'
  | 'origin_or_app'
  | 'inconclusive';

export type EdgeOverrideDiagnosis = {
  owner: EdgeOverrideOwner;
  confidence: 'alta' | 'média' | 'baixa';
  reason: string;
  nextAction: string;
};

export type EdgeOverrideSignals = {
  sameNonAppCsp: boolean;
  pageHasNonceSignal: boolean;
  pageCspHasNonce: boolean;
  cloudflareJsd: boolean;
  obsoleteHeaders: string[];
};

type CloudflareRuleCandidate = {
  source: string;
  rulesetName: string;
  phase: string;
  ruleDescription: string;
  enabled: boolean;
  action: string;
  headers: string[];
  matches: string[];
};

type CloudflareLookupResult = {
  candidates: CloudflareRuleCandidate[];
  problems: string[];
  evidence: string[];
};

type CloudflareLookupOptions = {
  apiToken?: string;
  zoneId?: string;
  zoneName?: string;
  fetchImpl?: typeof fetch;
};

type CloudflareTraceOptions = {
  apiToken?: string;
  accountId?: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  skipResponse?: boolean;
  skipChallenge?: boolean;
  fetchImpl?: typeof fetch;
};

type CloudflareTraceFinding = {
  stepName: string;
  type: string;
  name: string;
  description: string;
  kind: string;
  matched: boolean | null;
  action: string;
  expression: string;
  headers: string[];
  matches: string[];
};

type CloudflareTraceResult = {
  findings: CloudflareTraceFinding[];
  problems: string[];
  evidence: string[];
};

const DEFAULT_BASE_URL = 'https://megasena-analyzer.com.br';
const DEFAULT_TIMEOUT_MS = 10000;
const THIRD_PARTY_SCRIPT_HINTS = [
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
  'https://cdn.tailwindcss.com',
  'https://aistudiocdn.com',
  'https://static.cloudflareinsights.com',
];
const OBSOLETE_EDGE_HEADERS = [
  'x-xss-protection',
  'x-download-options',
  'x-permitted-cross-domain-policies',
];
const CLOUDFLARE_CSP_MATCHES = [
  'content-security-policy',
  'unsafe-inline',
  'unsafe-eval',
  'script-src',
  'style-src',
];
const CLOUDFLARE_JSD_MARKERS = ['__CF$cv$params', '/cdn-cgi/challenge-platform/scripts/jsd'];
const BODY_SNIPPET_LIMIT = 200_000;
const BOOLEAN_ENV_TRUE = new Set(['1', 'true', 'yes', 'sim']);

export function buildEdgeUrl(baseUrl: string, pathname: string): string {
  const url = new URL(baseUrl);
  url.pathname = pathname;
  url.search = `cb=${Date.now()}`;
  url.hash = '';
  return url.toString();
}

export function parseCsp(csp: string): Map<string, string> {
  const directives = new Map<string, string>();
  for (const rawDirective of csp.split(';')) {
    const directive = rawDirective.trim();
    if (directive.length === 0) {
      continue;
    }

    const [name, ...valueParts] = directive.split(/\s+/);
    if (name) {
      directives.set(name.toLowerCase(), valueParts.join(' '));
    }
  }
  return directives;
}

export function summarizeCsp(csp: string | null): CspSummary | null {
  if (!csp) {
    return null;
  }

  const normalized = csp.trim().replace(/\s+/g, ' ');
  const parsed = parseCsp(normalized);
  const directives = [...parsed.keys()];
  const highlightedSources = [
    parsed.get('script-src')?.includes("'unsafe-inline'") === true ||
    parsed.get('style-src')?.includes("'unsafe-inline'") === true
      ? "'unsafe-inline'"
      : null,
    parsed.get('script-src')?.includes("'unsafe-eval'") === true ? "'unsafe-eval'" : null,
    ...THIRD_PARTY_SCRIPT_HINTS,
  ].filter((source): source is string => source !== null && normalized.includes(source));

  return {
    digest: createHash('sha256').update(normalized).digest('hex').slice(0, 16),
    directives,
    highlightedSources,
  };
}

export function validatePageCsp(csp: string | null): CspCheck {
  const problems: string[] = [];
  const evidence: string[] = [];

  if (!csp) {
    return {
      ok: false,
      title: 'CSP da página ausente',
      problems: ['A resposta HTML pública não retornou Content-Security-Policy.'],
      evidence,
    };
  }

  const directives = parseCsp(csp);
  const scriptSrc = directives.get('script-src') ?? '';
  const styleSrc = directives.get('style-src') ?? '';
  const styleSrcAttr = directives.get('style-src-attr') ?? '';

  if (!/'nonce-[^']+'/.test(scriptSrc)) {
    problems.push('script-src não contém nonce por request.');
  }
  if (!scriptSrc.includes("'strict-dynamic'")) {
    problems.push("script-src não contém 'strict-dynamic'.");
  }
  if (scriptSrc.includes("'unsafe-inline'")) {
    problems.push("script-src contém 'unsafe-inline'.");
  }
  if (scriptSrc.includes("'unsafe-eval'")) {
    problems.push("script-src contém 'unsafe-eval'.");
  }
  if (!/'nonce-[^']+'/.test(styleSrc)) {
    problems.push('style-src não contém nonce por request.');
  }
  if (styleSrc.includes("'unsafe-inline'")) {
    problems.push("style-src contém 'unsafe-inline'.");
  }

  const thirdPartyScripts = THIRD_PARTY_SCRIPT_HINTS.filter((origin) => scriptSrc.includes(origin));
  if (thirdPartyScripts.length > 0) {
    problems.push(
      `script-src inclui origens de terceiros fora do contrato do app: ${thirdPartyScripts.join(', ')}.`
    );
  }

  evidence.push(`script-src=${scriptSrc || '(ausente)'}`);
  evidence.push(`style-src=${styleSrc || '(ausente)'}`);
  if (styleSrcAttr) {
    evidence.push(`style-src-attr=${styleSrcAttr}`);
  }

  return {
    ok: problems.length === 0,
    title: 'CSP da página',
    problems,
    evidence,
  };
}

export function validateApiCsp(csp: string | null): CspCheck {
  const expected = buildApiSecurityHeaders(false, false)['Content-Security-Policy'];
  const problems = csp === expected ? [] : [`CSP da API difere do contrato esperado: ${expected}`];

  return {
    ok: problems.length === 0,
    title: 'CSP da API',
    problems,
    evidence: [`observado=${csp || '(ausente)'}`],
  };
}

function hasNonceSignal(snapshot: ResponseSnapshot): boolean {
  return (
    (snapshot.headers.get('link') ?? '').includes('nonce=') ||
    /\snonce=(?:"[^"]+"|'[^']+'|[^\s>]+)/.test(snapshot.bodySnippet)
  );
}

function hasCloudflareJavascriptDetection(snapshot: ResponseSnapshot): boolean {
  return CLOUDFLARE_JSD_MARKERS.some((marker) => snapshot.bodySnippet.includes(marker));
}

function usesSameNonAppCsp(pageCsp: string | null, apiCsp: string | null): boolean {
  const expectedApiCsp = buildApiSecurityHeaders(false, false)['Content-Security-Policy'];
  return Boolean(pageCsp && apiCsp && pageCsp === apiCsp && apiCsp !== expectedApiCsp);
}

export function inferEdgeOverrideDiagnosis(signals: EdgeOverrideSignals): EdgeOverrideDiagnosis {
  if (signals.sameNonAppCsp && signals.pageHasNonceSignal && !signals.pageCspHasNonce) {
    return {
      owner: 'shared_response_headers',
      confidence: 'alta',
      reason: 'HTML e API compartilham uma CSP não-app enquanto o HTML ainda contém nonce do app.',
      nextAction:
        'procure uma regra global de response headers no Cloudflare ou no reverse proxy que defina Content-Security-Policy.',
    };
  }

  if (signals.sameNonAppCsp) {
    return {
      owner: 'shared_response_headers',
      confidence: 'média',
      reason: 'HTML e API compartilham a mesma CSP não-app.',
      nextAction:
        'comece por Response Header Transform Rules e middleware de headers antes de Page Shield.',
    };
  }

  if (signals.cloudflareJsd && !signals.pageCspHasNonce) {
    return {
      owner: 'cloudflare_client_side_security',
      confidence: 'média',
      reason: 'Cloudflare JavaScript Detections está ativo e a CSP pública perdeu o nonce.',
      nextAction:
        'verifique Client-side security/Page Shield e confirme se alguma política injeta CSP sem nonce.',
    };
  }

  if (!signals.pageHasNonceSignal && !signals.pageCspHasNonce) {
    return {
      owner: 'origin_or_app',
      confidence: 'média',
      reason: 'a resposta pública não mostra nonce nem CSP nonce-based.',
      nextAction:
        'compare com ORIGIN_BASE_URL ou verifique se o servidor público está rodando a release atual.',
    };
  }

  if (signals.obsoleteHeaders.length > 0) {
    return {
      owner: 'shared_response_headers',
      confidence: 'baixa',
      reason: 'headers externos/obsoletos indicam uma camada de headers fora do app.',
      nextAction:
        'audite Cloudflare/Traefik/Nginx por políticas que adicionem headers de segurança compartilhados.',
    };
  }

  return {
    owner: 'inconclusive',
    confidence: 'baixa',
    reason: 'os sinais públicos ainda não isolam a camada que alterou a CSP.',
    nextAction:
      'rode com ORIGIN_BASE_URL ou com Cloudflare API/Trace read-only para separar origem, borda e proxy.',
  };
}

export function buildEdgeOverrideActions(
  diagnosis: EdgeOverrideDiagnosis,
  sharedCspSummary?: CspSummary | null
): string[] {
  const fingerprint = sharedCspSummary
    ? `sha256:${sharedCspSummary.digest}`
    : 'fingerprint impresso';

  if (diagnosis.owner === 'shared_response_headers') {
    return [
      `correlacione ${fingerprint} com regras que definem Content-Security-Policy na borda ou no proxy.`,
      'no Cloudflare, verifique Rules > Transform Rules > Modify Response Header antes de Page Shield.',
      'remova apenas a operação que define Content-Security-Policy; preserve HSTS e outros headers necessários no proxy.',
      'faça purge de cache se aplicável e rode novamente bun run security:csp:edge; sucesso exige CSP nonce-based na home e CSP deny-by-default na API.',
    ];
  }

  if (diagnosis.owner === 'cloudflare_client_side_security') {
    return [
      'verifique Cloudflare Client-side security/Page Shield para políticas em modo Allow que adicionem CSP sem nonce.',
      'desative a injeção de CSP dessa política ou mude para uma configuração que preserve a CSP nonce-based do app.',
      'rode novamente bun run security:csp:edge e confirme que Cloudflare JSD não remove o nonce da CSP pública.',
    ];
  }

  if (diagnosis.owner === 'origin_or_app') {
    return [
      'confirme primeiro que a produção pública está na mesma versão de package.json com bun run deploy:verify.',
      'se houver origem direta, rode ORIGIN_BASE_URL=https://origin.example.com bun run security:csp:edge usando apenas placeholder em docs.',
      'se origem e borda falharem, investigue a release implantada antes de alterar Cloudflare.',
    ];
  }

  return [
    'rode com ORIGIN_BASE_URL ou Cloudflare API/Trace read-only para separar app, origem direta, Cloudflare e reverse proxy.',
    'não registre IDs de regras, hosts privados, caminhos reais, tokens ou URLs de origem em commits ou logs públicos.',
  ];
}

export function classifyEdgeOverride(page: ResponseSnapshot, api: ResponseSnapshot): CspCheck {
  const problems: string[] = [];
  const evidence: string[] = [];
  const pageCsp = page.headers.get('content-security-policy');
  const apiCsp = api.headers.get('content-security-policy');
  const server = page.headers.get('server') ?? api.headers.get('server') ?? '';
  const pageHasNonceSignal = hasNonceSignal(page);
  const pageCspHasNonce = pageCsp?.includes("'nonce-") ?? false;
  const sameNonAppCsp = usesSameNonAppCsp(pageCsp, apiCsp);
  const cloudflareJsd = hasCloudflareJavascriptDetection(page);
  const obsoleteHeaders = OBSOLETE_EDGE_HEADERS.filter(
    (header) => page.headers.has(header) || api.headers.has(header)
  );
  const sharedCspSummary = sameNonAppCsp ? summarizeCsp(pageCsp) : null;
  const diagnosis = inferEdgeOverrideDiagnosis({
    sameNonAppCsp,
    pageHasNonceSignal,
    pageCspHasNonce,
    cloudflareJsd,
    obsoleteHeaders,
  });

  if (server.toLowerCase().includes('cloudflare')) {
    evidence.push('server=cloudflare');
  }
  if (pageHasNonceSignal) {
    evidence.push('HTML/Link público ainda contém nonce gerado pela aplicação.');
  }
  if (sameNonAppCsp) {
    evidence.push('home e /api/health retornam a mesma CSP fora do contrato da aplicação.');
    const summary = sharedCspSummary;
    if (summary) {
      evidence.push(
        `fingerprint da CSP compartilhada: sha256:${summary.digest}; diretivas=${summary.directives.join(', ') || '(nenhuma)'}`
      );
      if (summary.highlightedSources.length > 0) {
        evidence.push(
          `fontes suspeitas na CSP compartilhada: ${summary.highlightedSources.join(', ')}`
        );
      }
    }
  }
  if (obsoleteHeaders.length > 0) {
    evidence.push(`headers externos/obsoletos presentes: ${obsoleteHeaders.join(', ')}`);
  }
  if (cloudflareJsd) {
    evidence.push('Cloudflare JavaScript Detections injetou script em HTML público.');
  }
  if (sameNonAppCsp) {
    evidence.push(
      'hipótese principal: regra compartilhada de response headers na borda/proxy, não apenas CSP de página.'
    );
  }
  if (diagnosis.owner !== 'inconclusive') {
    evidence.push(
      `diagnóstico provável: ${diagnosis.owner} (${diagnosis.confidence}); ${diagnosis.reason}`
    );
    evidence.push(`próxima ação recomendada: ${diagnosis.nextAction}`);
  }

  if (pageHasNonceSignal && pageCsp && !pageCspHasNonce) {
    problems.push(
      'A aplicação gerou nonce, mas alguma camada posterior substituiu Content-Security-Policy.'
    );
  }
  if (sameNonAppCsp) {
    problems.push(
      'A mesma CSP não-app aparece em HTML e API; procure regra global de response headers.'
    );
  }
  if (obsoleteHeaders.length > 0) {
    problems.push(
      'A resposta pública inclui headers que não são emitidos por lib/security/csp.ts.'
    );
  }
  if (cloudflareJsd && pageCsp && !pageCspHasNonce) {
    problems.push('Cloudflare JSD está ativo enquanto a CSP pública perdeu o nonce esperado.');
  }

  return {
    ok: problems.length === 0,
    title: 'Classificação da borda',
    problems,
    evidence,
    actions: buildEdgeOverrideActions(diagnosis, sharedCspSummary),
  };
}

export function classifyOriginComparison(
  edgePage: ResponseSnapshot,
  edgeApi: ResponseSnapshot,
  originPage: ResponseSnapshot,
  originApi: ResponseSnapshot
): CspCheck {
  const problems: string[] = [];
  const evidence: string[] = ['ORIGIN_BASE_URL consultado; URL direta não será impressa.'];
  const edgePageCsp = edgePage.headers.get('content-security-policy');
  const edgeApiCsp = edgeApi.headers.get('content-security-policy');
  const originPageCsp = originPage.headers.get('content-security-policy');
  const originApiCsp = originApi.headers.get('content-security-policy');
  const edgePageCheck = validatePageCsp(edgePageCsp);
  const edgeApiCheck = validateApiCsp(edgeApiCsp);
  const originPageCheck = validatePageCsp(originPageCsp);
  const originApiCheck = validateApiCsp(originApiCsp);
  const edgeHasSharedNonAppCsp = usesSameNonAppCsp(edgePageCsp, edgeApiCsp);

  evidence.push(`origem direta: home ${originPage.status}, api ${originApi.status}.`);

  const originPageSummary = summarizeCsp(originPageCsp);
  if (originPageSummary) {
    evidence.push(`fingerprint da CSP da origem direta: sha256:${originPageSummary.digest}`);
  }
  const edgePageSummary = summarizeCsp(edgePageCsp);
  if (edgePageSummary && originPageSummary && edgePageSummary.digest !== originPageSummary.digest) {
    evidence.push(
      `fingerprint da CSP pública difere da origem direta: edge sha256:${edgePageSummary.digest} != origem sha256:${originPageSummary.digest}.`
    );
  }

  if (originPageCheck.ok && originApiCheck.ok && (!edgePageCheck.ok || !edgeApiCheck.ok)) {
    evidence.push(
      'origem direta mantém o contrato de CSP; a substituição acontece depois da aplicação.'
    );
  }
  if (edgeHasSharedNonAppCsp && originPageCheck.ok && originApiCheck.ok) {
    evidence.push(
      'home/API públicas compartilham CSP não-app, mas a origem direta não; priorize Cloudflare/Traefik.'
    );
  }
  if (!originPageCheck.ok) {
    problems.push(
      `origem direta também falha no contrato de CSP da página: ${originPageCheck.problems.join(' ')}`
    );
  }
  if (!originApiCheck.ok) {
    problems.push(
      `origem direta também falha no contrato de CSP da API: ${originApiCheck.problems.join(' ')}`
    );
  }

  return {
    ok: problems.length === 0,
    title: 'Comparação com origem direta',
    problems,
    evidence,
  };
}

async function readResponseSnapshot(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  includeBody: boolean
): Promise<ResponseSnapshot> {
  const response = await fetchImpl(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const contentType = response.headers.get('content-type') ?? '';
  const bodySnippet =
    includeBody && contentType.toLowerCase().includes('text/html')
      ? (await response.text()).slice(0, BODY_SNIPPET_LIMIT)
      : '';

  return {
    url,
    status: response.status,
    headers: response.headers,
    bodySnippet,
  };
}

function safeNetworkError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/https?:\/\/[^\s)]+/g, '<url-redigida>').slice(0, 180);
}

export async function checkEdgeCsp(options: EdgeCspOptions): Promise<CspCheck[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const page = await readResponseSnapshot(
    buildEdgeUrl(options.baseUrl, '/'),
    fetchImpl,
    options.timeoutMs,
    true
  );
  const api = await readResponseSnapshot(
    buildEdgeUrl(options.baseUrl, '/api/health'),
    fetchImpl,
    options.timeoutMs,
    false
  );

  const checks = [
    validatePageCsp(page.headers.get('content-security-policy')),
    validateApiCsp(api.headers.get('content-security-policy')),
    classifyEdgeOverride(page, api),
  ];

  if (!options.originBaseUrl) {
    return checks;
  }

  try {
    const originPage = await readResponseSnapshot(
      buildEdgeUrl(options.originBaseUrl, '/'),
      fetchImpl,
      options.timeoutMs,
      true
    );
    const originApi = await readResponseSnapshot(
      buildEdgeUrl(options.originBaseUrl, '/api/health'),
      fetchImpl,
      options.timeoutMs,
      false
    );
    checks.push(classifyOriginComparison(page, api, originPage, originApi));
  } catch (error) {
    checks.push({
      ok: false,
      title: 'Comparação com origem direta',
      problems: [`não foi possível consultar ORIGIN_BASE_URL (${safeNetworkError(error)}).`],
      evidence: ['ORIGIN_BASE_URL foi omitido da saída para não expor alvo privado.'],
    });
  }

  return checks;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function stringProp(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function boolProp(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = record[key];
  return typeof value === 'boolean' ? value : fallback;
}

function optionalBoolProp(record: Record<string, unknown>, key: string): boolean | null {
  const value = record[key];
  return typeof value === 'boolean' ? value : null;
}

function arrayProp(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function extractHeaderNames(value: unknown): string[] {
  const serialized = JSON.stringify(value ?? {});
  return [...serialized.matchAll(/"name":"([^"]+)"/g)].flatMap((match) =>
    match[1] ? [match[1]] : []
  );
}

export function findCloudflareCspRuleCandidates(rulesets: unknown[]): CloudflareRuleCandidate[] {
  const candidates: CloudflareRuleCandidate[] = [];

  for (const rulesetValue of rulesets) {
    const ruleset = asRecord(rulesetValue);
    if (!ruleset) {
      continue;
    }

    const phase = stringProp(ruleset, 'phase');
    const rulesetName = stringProp(ruleset, 'name') || '(ruleset sem nome)';
    for (const ruleValue of arrayProp(ruleset, 'rules')) {
      const rule = asRecord(ruleValue);
      if (!rule) {
        continue;
      }

      const serializedRule = JSON.stringify(rule).toLowerCase();
      const matches = CLOUDFLARE_CSP_MATCHES.filter((needle) => serializedRule.includes(needle));
      if (matches.length === 0) {
        continue;
      }

      candidates.push({
        source: 'rulesets',
        rulesetName,
        phase,
        ruleDescription: stringProp(rule, 'description') || '(regra sem descrição)',
        enabled: boolProp(rule, 'enabled', true),
        action: stringProp(rule, 'action') || '(sem action)',
        headers: extractHeaderNames(rule['action_parameters']),
        matches,
      });
    }
  }

  return candidates;
}

export function findCloudflarePageShieldCandidates(policies: unknown[]): CloudflareRuleCandidate[] {
  const candidates: CloudflareRuleCandidate[] = [];

  for (const policyValue of policies) {
    const policy = asRecord(policyValue);
    if (!policy) {
      continue;
    }

    const serializedPolicy = JSON.stringify(policy).toLowerCase();
    const matches = CLOUDFLARE_CSP_MATCHES.filter((needle) => serializedPolicy.includes(needle));
    if (matches.length === 0) {
      continue;
    }

    candidates.push({
      source: 'page_shield',
      rulesetName: stringProp(policy, 'name') || 'Client-side security / Page Shield',
      phase: 'content_security_rule',
      ruleDescription:
        stringProp(policy, 'description') ||
        stringProp(policy, 'name') ||
        '(política sem descrição)',
      enabled: boolProp(policy, 'enabled', true),
      action: stringProp(policy, 'action') || stringProp(policy, 'mode') || '(ver política)',
      headers: ['Content-Security-Policy'],
      matches,
    });
  }

  return candidates;
}

async function parseCloudflareResponse(response: Response): Promise<unknown> {
  const body = (await response.json()) as unknown;
  const record = asRecord(body);
  const success = record?.['success'];

  if (!response.ok || success === false) {
    const errors = record ? arrayProp(record, 'errors') : [];
    const message =
      errors
        .map((error) => {
          const errorRecord = asRecord(error);
          return errorRecord ? stringProp(errorRecord, 'message') : '';
        })
        .filter(Boolean)
        .join('; ') || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return record?.['result'];
}

async function readCloudflareJson(
  pathname: string,
  apiToken: string,
  fetchImpl: typeof fetch
): Promise<unknown> {
  return parseCloudflareResponse(
    await fetchImpl(`https://api.cloudflare.com/client/v4${pathname}`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${apiToken}`,
      },
    })
  );
}

async function postCloudflareJson(
  pathname: string,
  apiToken: string,
  fetchImpl: typeof fetch,
  payload: unknown
): Promise<unknown> {
  return parseCloudflareResponse(
    await fetchImpl(`https://api.cloudflare.com/client/v4${pathname}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${apiToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  );
}

function safeCloudflareError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer <redigido>').slice(0, 180);
}

async function resolveCloudflareZoneId(
  options: Required<Pick<CloudflareLookupOptions, 'fetchImpl'>> & CloudflareLookupOptions
): Promise<{ zoneId: string | null; problems: string[]; evidence: string[] }> {
  const problems: string[] = [];
  const evidence: string[] = [];

  if (options.zoneId) {
    evidence.push('Cloudflare API: usando CLOUDFLARE_ZONE_ID informado; ID não será impresso.');
    return { zoneId: options.zoneId, problems, evidence };
  }
  if (!options.apiToken || !options.zoneName) {
    problems.push(
      'Cloudflare API: informe CLOUDFLARE_API_TOKEN e CLOUDFLARE_ZONE_ID ou CLOUDFLARE_ZONE_NAME.'
    );
    return { zoneId: null, problems, evidence };
  }

  let result: unknown;
  try {
    result = await readCloudflareJson(
      `/zones?name=${encodeURIComponent(options.zoneName)}&per_page=5`,
      options.apiToken,
      options.fetchImpl
    );
  } catch (error) {
    problems.push(
      `Cloudflare API: falha ao resolver a zona por nome (${safeCloudflareError(error)}).`
    );
    return { zoneId: null, problems, evidence };
  }

  const zones = Array.isArray(result) ? result : [];
  const firstZone = asRecord(zones[0]);
  const zoneId = firstZone ? stringProp(firstZone, 'id') || null : null;
  if (!zoneId) {
    problems.push(
      `Cloudflare API: zona ${options.zoneName} não encontrada ou não acessível pelo token informado.`
    );
    return { zoneId: null, problems, evidence };
  }

  evidence.push(`Cloudflare API: zona resolvida por nome público (${options.zoneName}).`);
  return { zoneId, problems, evidence };
}

export async function inspectCloudflareCspRules(
  options: CloudflareLookupOptions
): Promise<CloudflareLookupResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const candidates: CloudflareRuleCandidate[] = [];
  const problems: string[] = [];
  const evidence: string[] = [];

  if (!options.apiToken) {
    problems.push(
      'Cloudflare API: token ausente; defina um token read-only para localizar regras candidatas.'
    );
    return { candidates, problems, evidence };
  }

  const zoneResolution = await resolveCloudflareZoneId({ ...options, fetchImpl });
  problems.push(...zoneResolution.problems);
  evidence.push(...zoneResolution.evidence);
  const { zoneId } = zoneResolution;

  if (!zoneId) {
    return { candidates, problems, evidence };
  }

  const rulesets: unknown[] = [];
  const summaries = await readCloudflareJson(
    `/zones/${zoneId}/rulesets`,
    options.apiToken,
    fetchImpl
  )
    .then((result) => (Array.isArray(result) ? result : []))
    .catch((error) => {
      problems.push(
        `Cloudflare API: falha ao listar Rulesets da zona (${safeCloudflareError(error)}).`
      );
      return [];
    });

  for (const summaryValue of summaries) {
    const summary = asRecord(summaryValue);
    const rulesetId = summary ? stringProp(summary, 'id') : '';
    if (!rulesetId) {
      continue;
    }
    const ruleset = await readCloudflareJson(
      `/zones/${zoneId}/rulesets/${rulesetId}`,
      options.apiToken,
      fetchImpl
    ).catch((error) => {
      problems.push(
        `Cloudflare API: falha ao ler um Ruleset da zona (${safeCloudflareError(error)}).`
      );
      return null;
    });
    if (ruleset) {
      rulesets.push(ruleset);
    }
  }

  const policiesResult = await readCloudflareJson(
    `/zones/${zoneId}/page_shield/policies`,
    options.apiToken,
    fetchImpl
  ).catch((error) => {
    problems.push(
      `Cloudflare API: falha ao listar Client-side security/Page Shield (${safeCloudflareError(error)}).`
    );
    return [];
  });
  const policies = Array.isArray(policiesResult) ? policiesResult : [];

  candidates.push(
    ...findCloudflareCspRuleCandidates(rulesets),
    ...findCloudflarePageShieldCandidates(policies)
  );

  if (candidates.length === 0 && problems.length === 0) {
    evidence.push(
      'Cloudflare API: zona acessível, mas nenhuma regra candidata de CSP foi encontrada.'
    );
  }

  return { candidates, problems, evidence };
}

export async function findCloudflareCspRules(
  options: CloudflareLookupOptions
): Promise<CloudflareRuleCandidate[]> {
  return (await inspectCloudflareCspRules(options)).candidates;
}

function flattenCloudflareTraceItems(trace: unknown): Record<string, unknown>[] {
  const items = Array.isArray(trace) ? trace : [];
  const flattened: Record<string, unknown>[] = [];

  for (const itemValue of items) {
    const item = asRecord(itemValue);
    if (!item) {
      continue;
    }

    flattened.push(item);
    flattened.push(...flattenCloudflareTraceItems(item['trace']));
  }

  return flattened;
}

export function findCloudflareTraceCspFindings(trace: unknown): CloudflareTraceFinding[] {
  const findings: CloudflareTraceFinding[] = [];

  for (const item of flattenCloudflareTraceItems(trace)) {
    const serializedItem = JSON.stringify(item).toLowerCase();
    const matches = CLOUDFLARE_CSP_MATCHES.filter((needle) => serializedItem.includes(needle));
    const matched = optionalBoolProp(item, 'matched');
    if (matches.length === 0 || matched === false) {
      continue;
    }

    findings.push({
      stepName: stringProp(item, 'step_name') || '(passo sem nome)',
      type: stringProp(item, 'type') || '(tipo desconhecido)',
      name: stringProp(item, 'name') || '(configuração sem nome)',
      description: stringProp(item, 'description') || '(sem descrição)',
      kind: stringProp(item, 'kind') || '(sem kind)',
      matched,
      action: stringProp(item, 'action') || '(sem action)',
      expression: stringProp(item, 'expression') || '(sem expression)',
      headers: extractHeaderNames(item['action_parameters']),
      matches,
    });
  }

  return findings;
}

export function parseCloudflareTraceHeaders(value: string | undefined): {
  headers: Record<string, string>;
  problems: string[];
} {
  if (!value) {
    return { headers: {}, problems: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return {
      headers: {},
      problems: ['Cloudflare Trace: CLOUDFLARE_TRACE_HEADERS_JSON deve ser um objeto JSON.'],
    };
  }

  const record = asRecord(parsed);
  if (!record) {
    return {
      headers: {},
      problems: ['Cloudflare Trace: CLOUDFLARE_TRACE_HEADERS_JSON deve ser um objeto JSON.'],
    };
  }

  const headers: Record<string, string> = {};
  const problems: string[] = [];
  for (const [name, rawValue] of Object.entries(record)) {
    if (typeof rawValue !== 'string') {
      problems.push(`Cloudflare Trace: header ${name} ignorado porque o valor não é string.`);
      continue;
    }
    headers[name] = rawValue;
  }

  return { headers, problems };
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  return value ? BOOLEAN_ENV_TRUE.has(value.toLowerCase()) : undefined;
}

export async function inspectCloudflareTrace(
  options: CloudflareTraceOptions
): Promise<CloudflareTraceResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const findings: CloudflareTraceFinding[] = [];
  const problems: string[] = [];
  const evidence: string[] = [];
  const method = (options.method || 'GET').toUpperCase();

  if (!options.apiToken) {
    problems.push('Cloudflare Trace: token ausente; defina CLOUDFLARE_API_TOKEN.');
    return { findings, problems, evidence };
  }
  if (!options.accountId) {
    problems.push(
      'Cloudflare Trace: defina CLOUDFLARE_ACCOUNT_ID; o token precisa da permissão Allow Request Tracer Read.'
    );
    return { findings, problems, evidence };
  }

  let result: unknown;
  try {
    const payload: Record<string, unknown> = {
      method,
      url: options.url,
    };
    if (options.headers && Object.keys(options.headers).length > 0) {
      payload['headers'] = options.headers;
      evidence.push(
        `Cloudflare Trace: ${Object.keys(options.headers).length} header(s) customizado(s) enviados.`
      );
    }
    if (typeof options.skipResponse === 'boolean') {
      payload['skip_response'] = options.skipResponse;
      evidence.push(`Cloudflare Trace: skip_response=${options.skipResponse}.`);
    }
    if (typeof options.skipChallenge === 'boolean') {
      payload['context'] = { skip_challenge: options.skipChallenge };
      evidence.push(`Cloudflare Trace: skip_challenge=${options.skipChallenge}.`);
    }

    result = await postCloudflareJson(
      `/accounts/${encodeURIComponent(options.accountId)}/request-tracer/trace`,
      options.apiToken,
      fetchImpl,
      payload
    );
  } catch (error) {
    problems.push(
      `Cloudflare Trace: falha ao executar Request Trace (${safeCloudflareError(error)}).`
    );
    return { findings, problems, evidence };
  }

  const traceResult = asRecord(result);
  const statusCode = traceResult?.['status_code'];
  if (typeof statusCode === 'number') {
    evidence.push(`Cloudflare Trace: status de origem simulado=${statusCode}.`);
  }

  findings.push(...findCloudflareTraceCspFindings(traceResult?.['trace']));
  if (findings.length === 0) {
    evidence.push('Cloudflare Trace: nenhum passo avaliado/matched citou Content-Security-Policy.');
  }

  return { findings, problems, evidence };
}

function printCheck(check: CspCheck): void {
  console.log(`${check.ok ? 'OK' : 'FALHA'}: ${check.title}`);
  for (const problem of check.problems) {
    console.log(`  - ${problem}`);
  }
  for (const item of check.evidence) {
    console.log(`  evidência: ${item}`);
  }
  for (const action of check.actions ?? []) {
    console.log(`  ação: ${action}`);
  }
}

function printCloudflareLookup(result: CloudflareLookupResult): void {
  for (const problem of result.problems) {
    console.log(problem);
  }
  for (const item of result.evidence) {
    console.log(item);
  }

  const { candidates } = result;
  if (candidates.length === 0) {
    return;
  }

  console.log('Cloudflare API: regras candidatas encontradas:');
  for (const candidate of candidates) {
    console.log(
      `  - ${candidate.enabled ? 'ativa' : 'inativa'} | ${candidate.source} | ${candidate.phase} | ${candidate.rulesetName} | ${candidate.ruleDescription}`
    );
    console.log(
      `    action=${candidate.action}; headers=${candidate.headers.join(', ') || '(não declarado)'}`
    );
    console.log(`    matches=${candidate.matches.join(', ') || '(phase-only)'}`);
  }
}

function printCloudflareTrace(result: CloudflareTraceResult): void {
  for (const problem of result.problems) {
    console.log(problem);
  }
  for (const item of result.evidence) {
    console.log(item);
  }

  if (result.findings.length === 0) {
    return;
  }

  console.log('Cloudflare Trace: passos CSP encontrados:');
  for (const finding of result.findings) {
    console.log(
      `  - ${finding.matched === false ? 'not-matched' : 'matched'} | ${finding.type} | ${finding.stepName} | ${finding.name} | ${finding.description}`
    );
    console.log(
      `    action=${finding.action}; kind=${finding.kind}; headers=${finding.headers.join(', ') || '(não declarado)'}`
    );
    console.log(`    matches=${finding.matches.join(', ')}`);
    console.log(`    expression=${finding.expression}`);
  }
}

async function main(): Promise<void> {
  const baseUrl = process.env['PRODUCTION_BASE_URL'] || DEFAULT_BASE_URL;
  const originBaseUrl = process.env['ORIGIN_BASE_URL'];
  const timeoutMs = Number(process.env['PRODUCTION_CHECK_TIMEOUT_MS'] || DEFAULT_TIMEOUT_MS);

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('PRODUCTION_CHECK_TIMEOUT_MS deve ser um número positivo.');
  }

  const edgeOptions: EdgeCspOptions = { baseUrl, timeoutMs };
  if (originBaseUrl) {
    edgeOptions.originBaseUrl = originBaseUrl;
  }
  const checks = await checkEdgeCsp(edgeOptions);
  checks.forEach(printCheck);

  if (checks.some((check) => !check.ok)) {
    if (process.env['CLOUDFLARE_API_TOKEN']) {
      const zoneName = process.env['CLOUDFLARE_ZONE_NAME'] || new URL(baseUrl).hostname;
      const lookupOptions: CloudflareLookupOptions = {
        apiToken: process.env['CLOUDFLARE_API_TOKEN'],
        zoneName,
      };
      if (process.env['CLOUDFLARE_ZONE_ID']) {
        lookupOptions.zoneId = process.env['CLOUDFLARE_ZONE_ID'];
      }
      const result = await inspectCloudflareCspRules(lookupOptions);
      printCloudflareLookup(result);

      const traceOptions: CloudflareTraceOptions = {
        apiToken: process.env['CLOUDFLARE_API_TOKEN'],
        url: process.env['CLOUDFLARE_TRACE_URL'] || buildEdgeUrl(baseUrl, '/'),
        method: process.env['CLOUDFLARE_TRACE_METHOD'] || 'GET',
      };
      if (process.env['CLOUDFLARE_ACCOUNT_ID']) {
        traceOptions.accountId = process.env['CLOUDFLARE_ACCOUNT_ID'];
      }
      const traceHeaders = parseCloudflareTraceHeaders(
        process.env['CLOUDFLARE_TRACE_HEADERS_JSON']
      );
      for (const problem of traceHeaders.problems) {
        console.log(problem);
      }
      traceOptions.headers = traceHeaders.headers;
      const skipResponse = parseOptionalBoolean(process.env['CLOUDFLARE_TRACE_SKIP_RESPONSE']);
      if (typeof skipResponse === 'boolean') {
        traceOptions.skipResponse = skipResponse;
      }
      const skipChallenge = parseOptionalBoolean(process.env['CLOUDFLARE_TRACE_SKIP_CHALLENGE']);
      if (typeof skipChallenge === 'boolean') {
        traceOptions.skipChallenge = skipChallenge;
      }
      const traceResult = await inspectCloudflareTrace(traceOptions);
      printCloudflareTrace(traceResult);
    } else {
      console.log(
        'Cloudflare API: defina CLOUDFLARE_API_TOKEN e CLOUDFLARE_ZONE_ID ou CLOUDFLARE_ZONE_NAME para listar regras candidatas; adicione CLOUDFLARE_ACCOUNT_ID para executar Cloudflare Trace sem imprimir segredos.'
      );
    }
    console.log(
      'Próximo passo: verificar Cloudflare Response Header Transform Rules/Page Shield/Trace e o middleware de headers do reverse proxy; remova qualquer regra que defina Content-Security-Policy.'
    );
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
