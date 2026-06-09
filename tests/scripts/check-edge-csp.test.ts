// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  buildEdgeUrl,
  checkEdgeCsp,
  classifyEdgeOverride,
  classifyOriginComparison,
  findCloudflareCspRules,
  findCloudflarePageShieldCandidates,
  findCloudflareCspRuleCandidates,
  findCloudflareTraceCspFindings,
  buildEdgeOverrideActions,
  inferEdgeOverrideDiagnosis,
  inspectCloudflareCspRules,
  inspectCloudflareTrace,
  parseCloudflareTraceHeaders,
  parseCsp,
  summarizeCsp,
  validateApiCsp,
  validatePageCsp,
} from '../../scripts/check-edge-csp';

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe('scripts/check-edge-csp.ts', () => {
  it('normaliza URLs públicas com cache buster', () => {
    const url = buildEdgeUrl('https://example.com/dashboard?old=1#hash', '/api/health');
    expect(url).toMatch(/^https:\/\/example\.com\/api\/health\?cb=\d+$/);
  });

  it('extrai diretivas CSP por nome', () => {
    const directives = parseCsp(
      "default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'"
    );
    expect(directives.get('default-src')).toBe("'self'");
    expect(directives.get('script-src')).toBe("'self' 'nonce-abc' 'strict-dynamic'");
  });

  it('resume CSP com fingerprint estável e fontes de risco', () => {
    expect(
      summarizeCsp(
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com"
      )
    ).toMatchObject({
      digest: expect.stringMatching(/^[a-f0-9]{16}$/),
      directives: ['default-src', 'script-src'],
      highlightedSources: ["'unsafe-inline'", 'https://cdn.tailwindcss.com'],
    });
  });

  it('não destaca unsafe-inline quando aparece apenas em style-src-attr permitido', () => {
    expect(
      summarizeCsp(
        "default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'; style-src 'self' 'nonce-abc'; style-src-attr 'unsafe-inline'"
      )
    ).toMatchObject({
      highlightedSources: [],
    });
  });

  it('aceita a CSP de página nonce-based esperada', () => {
    const result = validatePageCsp(
      "default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'; style-src 'self' 'nonce-abc' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'"
    );

    expect(result.ok).toBe(true);
    expect(result.evidence).toContain("style-src-attr='unsafe-inline'");
  });

  it('aceita a CSP de página nonce-based sem exceção de atributos de estilo', () => {
    expect(
      validatePageCsp(
        "default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'; style-src 'self' 'nonce-abc' https://fonts.googleapis.com"
      ).ok
    ).toBe(true);
  });

  it('rejeita CSP ampla injetada na borda', () => {
    const result = validatePageCsp(
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline'"
    );
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        'script-src não contém nonce por request.',
        "script-src contém 'unsafe-inline'.",
        "script-src contém 'unsafe-eval'.",
        "style-src contém 'unsafe-inline'.",
      ])
    );
  });

  it('aceita a CSP deny-by-default da API Bun', () => {
    expect(
      validateApiCsp(
        "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
      ).ok
    ).toBe(true);
  });

  it('classifica sobrescrita quando Link mantém nonce mas CSP pública não', () => {
    const result = classifyEdgeOverride(
      {
        url: 'https://example.com/',
        status: 200,
        bodySnippet: '<script nonce="abc">self.__next_f=[]</script>',
        headers: headers({
          server: 'cloudflare',
          'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'",
          'x-xss-protection': '1; mode=block',
        }),
      },
      {
        url: 'https://example.com/api/health',
        status: 200,
        bodySnippet: '',
        headers: headers({
          server: 'cloudflare',
          'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'",
        }),
      }
    );

    expect(result.ok).toBe(false);
    expect(result.problems).toContain(
      'A aplicação gerou nonce, mas alguma camada posterior substituiu Content-Security-Policy.'
    );
    expect(result.evidence).toContain('server=cloudflare');
  });

  it('prioriza regra global quando a mesma CSP não-app aparece em HTML e API', () => {
    const csp =
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline'";
    const result = classifyEdgeOverride(
      {
        url: 'https://example.com/',
        status: 200,
        bodySnippet:
          '<script nonce="abc">self.__next_f=[]</script><script>window.__CF$cv$params={};</script>',
        headers: headers({
          server: 'cloudflare',
          'content-security-policy': csp,
          'x-download-options': 'noopen',
        }),
      },
      {
        url: 'https://example.com/api/health',
        status: 200,
        bodySnippet: '',
        headers: headers({
          server: 'cloudflare',
          'content-security-policy': csp,
        }),
      }
    );

    expect(result.ok).toBe(false);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        'A mesma CSP não-app aparece em HTML e API; procure regra global de response headers.',
        'Cloudflare JSD está ativo enquanto a CSP pública perdeu o nonce esperado.',
      ])
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        'home e /api/health retornam a mesma CSP fora do contrato da aplicação.',
        expect.stringMatching(/^fingerprint da CSP compartilhada: sha256:[a-f0-9]{16}; diretivas=/),
        "fontes suspeitas na CSP compartilhada: 'unsafe-inline', https://cdn.tailwindcss.com",
        'Cloudflare JavaScript Detections injetou script em HTML público.',
        'hipótese principal: regra compartilhada de response headers na borda/proxy, não apenas CSP de página.',
        expect.stringContaining('diagnóstico provável: shared_response_headers (alta)'),
        expect.stringContaining(
          'próxima ação recomendada: procure uma regra global de response headers'
        ),
      ])
    );
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^correlacione sha256:[a-f0-9]{16} com regras/),
        'no Cloudflare, verifique Rules > Transform Rules > Modify Response Header antes de Page Shield.',
        expect.stringContaining('sucesso exige CSP nonce-based na home'),
      ])
    );
  });

  it('infere o dono provável da sobrescrita de CSP a partir de sinais públicos', () => {
    expect(
      inferEdgeOverrideDiagnosis({
        sameNonAppCsp: true,
        pageHasNonceSignal: true,
        pageCspHasNonce: false,
        cloudflareJsd: true,
        obsoleteHeaders: ['x-xss-protection'],
      })
    ).toMatchObject({
      owner: 'shared_response_headers',
      confidence: 'alta',
    });

    expect(
      inferEdgeOverrideDiagnosis({
        sameNonAppCsp: false,
        pageHasNonceSignal: false,
        pageCspHasNonce: false,
        cloudflareJsd: false,
        obsoleteHeaders: [],
      })
    ).toMatchObject({
      owner: 'origin_or_app',
      nextAction: expect.stringContaining('servidor público está rodando a release atual'),
    });
  });

  it('gera ações de remediação públicas para cada dono provável de CSP', () => {
    expect(
      buildEdgeOverrideActions({
        owner: 'shared_response_headers',
        confidence: 'alta',
        reason: 'same csp',
        nextAction: 'check edge',
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Transform Rules'),
        expect.stringContaining('Content-Security-Policy'),
      ])
    );

    expect(
      buildEdgeOverrideActions({
        owner: 'origin_or_app',
        confidence: 'média',
        reason: 'no nonce',
        nextAction: 'check deploy',
      })
    ).toEqual(expect.arrayContaining([expect.stringContaining('bun run deploy:verify')]));
  });

  it('compara borda pública com origem direta sem imprimir a URL privada', async () => {
    const expectedApiCsp =
      "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
    const edgeCsp =
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";
    const originCsp =
      "default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'; style-src 'self' 'nonce-abc'";
    const seenUrls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      seenUrls.push(url);
      if (url.startsWith('https://origin.internal.example/')) {
        return new Response(url.includes('/api/health') ? '{}' : '<script nonce="abc"></script>', {
          headers: {
            'content-type': url.includes('/api/health') ? 'application/json' : 'text/html',
            'content-security-policy': url.includes('/api/health') ? expectedApiCsp : originCsp,
          },
        });
      }

      return new Response(url.includes('/api/health') ? '{}' : '<script nonce="abc"></script>', {
        headers: {
          'content-type': url.includes('/api/health') ? 'application/json' : 'text/html',
          'content-security-policy': edgeCsp,
        },
      });
    };

    const checks = await checkEdgeCsp({
      baseUrl: 'https://edge.example',
      originBaseUrl: 'https://origin.internal.example',
      timeoutMs: 1000,
      fetchImpl,
    });
    const comparison = checks.find((check) => check.title === 'Comparação com origem direta');

    expect(seenUrls).toHaveLength(4);
    expect(comparison).toMatchObject({
      ok: true,
      problems: [],
      evidence: expect.arrayContaining([
        'ORIGIN_BASE_URL consultado; URL direta não será impressa.',
        'origem direta mantém o contrato de CSP; a substituição acontece depois da aplicação.',
        'home/API públicas compartilham CSP não-app, mas a origem direta não; priorize Cloudflare/Traefik.',
      ]),
    });
    expect(JSON.stringify(comparison)).not.toContain('origin.internal.example');
  });

  it('marca problema quando a origem direta também quebra a CSP', () => {
    const csp =
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";
    const result = classifyOriginComparison(
      {
        url: 'https://edge.example/',
        status: 200,
        bodySnippet: '<script nonce="abc"></script>',
        headers: headers({ 'content-security-policy': csp }),
      },
      {
        url: 'https://edge.example/api/health',
        status: 200,
        bodySnippet: '',
        headers: headers({ 'content-security-policy': csp }),
      },
      {
        url: 'https://origin.internal.example/',
        status: 200,
        bodySnippet: '<script nonce="abc"></script>',
        headers: headers({ 'content-security-policy': csp }),
      },
      {
        url: 'https://origin.internal.example/api/health',
        status: 200,
        bodySnippet: '',
        headers: headers({ 'content-security-policy': csp }),
      }
    );

    expect(result.ok).toBe(false);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('origem direta também falha no contrato de CSP da página'),
        expect.stringContaining('origem direta também falha no contrato de CSP da API'),
      ])
    );
    expect(JSON.stringify(result)).not.toContain('origin.internal.example');
  });

  it('encontra regras Cloudflare candidatas que definem CSP', () => {
    expect(
      findCloudflareCspRuleCandidates([
        {
          name: 'Response headers',
          phase: 'http_response_headers_transform',
          rules: [
            {
              enabled: true,
              action: 'rewrite',
              description: 'Set cache headers',
              action_parameters: {
                headers: [{ operation: 'set', name: 'Cache-Control', value: 'public, max-age=60' }],
              },
            },
            {
              enabled: true,
              action: 'rewrite',
              description: 'Set security headers',
              action_parameters: {
                headers: [
                  {
                    operation: 'set',
                    name: 'Content-Security-Policy',
                    value: "script-src 'self' 'unsafe-inline'",
                  },
                ],
              },
            },
          ],
        },
      ])
    ).toMatchObject([
      {
        source: 'rulesets',
        rulesetName: 'Response headers',
        phase: 'http_response_headers_transform',
        ruleDescription: 'Set security headers',
        enabled: true,
        action: 'rewrite',
        headers: ['Content-Security-Policy'],
        matches: expect.arrayContaining(['content-security-policy', 'unsafe-inline']),
      },
    ]);
  });

  it('encontra políticas Page Shield que podem adicionar CSP', () => {
    expect(
      findCloudflarePageShieldCandidates([
        {
          name: 'Cookie monitor only',
          enabled: true,
          action: 'log',
          cookies: [{ name: 'functional' }],
        },
        {
          name: 'Client-side allowlist',
          description: 'Allow known scripts',
          enabled: true,
          action: 'allow',
          directives: {
            'script-src': ["'self'", "'unsafe-inline'"],
          },
        },
      ])
    ).toMatchObject([
      {
        source: 'page_shield',
        rulesetName: 'Client-side allowlist',
        phase: 'content_security_rule',
        ruleDescription: 'Allow known scripts',
        enabled: true,
        action: 'allow',
        headers: ['Content-Security-Policy'],
        matches: expect.arrayContaining(['unsafe-inline', 'script-src']),
      },
    ]);
  });

  it('consulta Cloudflare por nome de zona e retorna regras candidatas', async () => {
    const requests: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      requests.push(url);

      if (url.endsWith('/zones?name=example.com&per_page=5')) {
        return Response.json({ success: true, result: [{ id: 'zone-123' }] });
      }
      if (url.endsWith('/zones/zone-123/rulesets')) {
        return Response.json({ success: true, result: [{ id: 'ruleset-456' }] });
      }
      if (url.endsWith('/zones/zone-123/rulesets/ruleset-456')) {
        return Response.json({
          success: true,
          result: {
            name: 'Response headers',
            phase: 'http_response_headers_transform',
            rules: [
              {
                enabled: true,
                action: 'rewrite',
                description: 'Set CSP',
                action_parameters: {
                  headers: [
                    { name: 'Content-Security-Policy', value: "script-src 'unsafe-inline'" },
                  ],
                },
              },
            ],
          },
        });
      }
      if (url.endsWith('/zones/zone-123/page_shield/policies')) {
        return Response.json({
          success: true,
          result: [
            {
              name: 'Client-side allowlist',
              enabled: true,
              action: 'allow',
              directives: { 'script-src': ["'self'", "'unsafe-inline'"] },
            },
          ],
        });
      }

      return Response.json(
        { success: false, errors: [{ message: 'unexpected URL' }] },
        { status: 404 }
      );
    };

    await expect(
      findCloudflareCspRules({
        apiToken: 'redacted-token',
        zoneName: 'example.com',
        fetchImpl,
      })
    ).resolves.toMatchObject([
      {
        source: 'rulesets',
        rulesetName: 'Response headers',
        phase: 'http_response_headers_transform',
        ruleDescription: 'Set CSP',
        headers: ['Content-Security-Policy'],
      },
      {
        source: 'page_shield',
        rulesetName: 'Client-side allowlist',
        phase: 'content_security_rule',
        action: 'allow',
      },
    ]);
    expect(requests).toEqual([
      'https://api.cloudflare.com/client/v4/zones?name=example.com&per_page=5',
      'https://api.cloudflare.com/client/v4/zones/zone-123/rulesets',
      'https://api.cloudflare.com/client/v4/zones/zone-123/rulesets/ruleset-456',
      'https://api.cloudflare.com/client/v4/zones/zone-123/page_shield/policies',
    ]);
  });

  it('diferencia zona inacessível de zona acessível sem regras candidatas', async () => {
    const inaccessibleFetch: typeof fetch = async () =>
      Response.json({ success: true, result: [] });

    await expect(
      inspectCloudflareCspRules({
        apiToken: 'redacted-token',
        zoneName: 'example.com',
        fetchImpl: inaccessibleFetch,
      })
    ).resolves.toMatchObject({
      candidates: [],
      problems: [
        'Cloudflare API: zona example.com não encontrada ou não acessível pelo token informado.',
      ],
      evidence: [],
    });

    const visibleFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/zones?name=example.com&per_page=5')) {
        return Response.json({ success: true, result: [{ id: 'zone-123' }] });
      }
      if (url.endsWith('/zones/zone-123/rulesets')) {
        return Response.json({ success: true, result: [] });
      }
      if (url.endsWith('/zones/zone-123/page_shield/policies')) {
        return Response.json({ success: true, result: [] });
      }
      return Response.json(
        { success: false, errors: [{ message: 'unexpected URL' }] },
        { status: 404 }
      );
    };

    await expect(
      inspectCloudflareCspRules({
        apiToken: 'redacted-token',
        zoneName: 'example.com',
        fetchImpl: visibleFetch,
      })
    ).resolves.toMatchObject({
      candidates: [],
      problems: [],
      evidence: [
        'Cloudflare API: zona resolvida por nome público (example.com).',
        'Cloudflare API: zona acessível, mas nenhuma regra candidata de CSP foi encontrada.',
      ],
    });
  });

  it('extrai passos CSP matched de uma resposta Cloudflare Trace aninhada', () => {
    expect(
      findCloudflareTraceCspFindings([
        {
          type: 'ruleset',
          step_name: 'http_response_headers_transform',
          name: 'Response header transforms',
          matched: true,
          trace: [
            {
              type: 'rule',
              step_name: 'rewrite header',
              description: 'Set CSP globally',
              matched: true,
              action: 'rewrite',
              expression: 'true',
              action_parameters: {
                headers: [
                  {
                    operation: 'set',
                    name: 'Content-Security-Policy',
                    value: "script-src 'self' 'unsafe-inline'",
                  },
                ],
              },
            },
            {
              type: 'rule',
              step_name: 'old CSP candidate',
              description: 'Disabled candidate',
              matched: false,
              action_parameters: {
                headers: [{ name: 'Content-Security-Policy', value: "script-src 'self'" }],
              },
            },
          ],
        },
      ])
    ).toMatchObject([
      {
        type: 'ruleset',
        stepName: 'http_response_headers_transform',
        name: 'Response header transforms',
        matched: true,
        matches: expect.arrayContaining(['content-security-policy']),
      },
      {
        type: 'rule',
        stepName: 'rewrite header',
        description: 'Set CSP globally',
        matched: true,
        action: 'rewrite',
        expression: 'true',
        headers: ['Content-Security-Policy'],
        matches: expect.arrayContaining(['content-security-policy', 'unsafe-inline']),
      },
    ]);
  });

  it('normaliza headers customizados para Cloudflare Trace', () => {
    expect(parseCloudflareTraceHeaders('{"User-Agent":"edge-check","X-Number":42}')).toMatchObject({
      headers: { 'User-Agent': 'edge-check' },
      problems: ['Cloudflare Trace: header X-Number ignorado porque o valor não é string.'],
    });

    expect(parseCloudflareTraceHeaders('{bad json')).toMatchObject({
      headers: {},
      problems: ['Cloudflare Trace: CLOUDFLARE_TRACE_HEADERS_JSON deve ser um objeto JSON.'],
    });
  });

  it('executa Cloudflare Trace com conta, token read-only e opções de simulação', async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });

      return Response.json({
        success: true,
        result: {
          status_code: 200,
          trace: [
            {
              type: 'rule',
              step_name: 'response header transform',
              description: 'Set CSP',
              matched: true,
              action: 'rewrite',
              action_parameters: {
                headers: [{ name: 'Content-Security-Policy', value: "script-src 'unsafe-inline'" }],
              },
            },
          ],
        },
      });
    };

    await expect(
      inspectCloudflareTrace({
        apiToken: 'redacted-token',
        accountId: 'account-123',
        url: 'https://example.com/',
        headers: { 'User-Agent': 'edge-check' },
        skipResponse: true,
        skipChallenge: true,
        fetchImpl,
      })
    ).resolves.toMatchObject({
      problems: [],
      evidence: [
        'Cloudflare Trace: 1 header(s) customizado(s) enviados.',
        'Cloudflare Trace: skip_response=true.',
        'Cloudflare Trace: skip_challenge=true.',
        'Cloudflare Trace: status de origem simulado=200.',
      ],
      findings: [
        {
          type: 'rule',
          stepName: 'response header transform',
          description: 'Set CSP',
          headers: ['Content-Security-Policy'],
        },
      ],
    });

    expect(requests).toEqual([
      {
        url: 'https://api.cloudflare.com/client/v4/accounts/account-123/request-tracer/trace',
        body: {
          method: 'GET',
          url: 'https://example.com/',
          headers: { 'User-Agent': 'edge-check' },
          skip_response: true,
          context: { skip_challenge: true },
        },
      },
    ]);
  });

  it('explica quando Cloudflare Trace não tem account id', async () => {
    await expect(
      inspectCloudflareTrace({
        apiToken: 'redacted-token',
        url: 'https://example.com/',
      })
    ).resolves.toMatchObject({
      findings: [],
      problems: [
        'Cloudflare Trace: defina CLOUDFLARE_ACCOUNT_ID; o token precisa da permissão Allow Request Tracer Read.',
      ],
      evidence: [],
    });
  });
});
