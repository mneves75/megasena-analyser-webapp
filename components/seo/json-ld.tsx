/**
 * JSON-LD Component for injecting structured data
 * Renders a script tag with application/ld+json type
 *
 * Note: dangerouslySetInnerHTML is safe here because content is always
 * JSON.stringify of trusted internal schema objects, never user input.
 */

interface JsonLdProps {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Multi-schema wrapper that outputs a single @graph script tag.
 * Strips individual @context from each schema and hoists it to the top level.
 */
interface MultiJsonLdProps {
  schemas: Array<Record<string, unknown>>;
}

export function MultiJsonLd({ schemas }: MultiJsonLdProps) {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': schemas.map(({ '@context': _, ...rest }) => rest),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
