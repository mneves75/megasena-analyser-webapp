import { headers } from 'next/headers';

async function resolveNonce(nonce: string | null | undefined): Promise<string | undefined> {
  if (nonce !== undefined) {
    return nonce ?? undefined;
  }

  try {
    return (await headers()).get('x-nonce') ?? undefined;
  } catch {
    return undefined;
  }
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * Multi-schema wrapper that outputs a single @graph script tag.
 * Strips individual @context from each schema and hoists it to the top level.
 */
interface MultiJsonLdProps {
  schemas: Array<Record<string, unknown>>;
  nonce?: string | null | undefined;
}

export async function MultiJsonLd({ schemas, nonce }: MultiJsonLdProps) {
  const resolvedNonce = await resolveNonce(nonce);
  const graph = {
    '@context': 'https://schema.org',
    '@graph': schemas.map(({ '@context': _, ...rest }) => rest),
  };
  return (
    <script
      nonce={resolvedNonce}
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph) }}
    />
  );
}
