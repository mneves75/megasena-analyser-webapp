/**
 * JSON-LD Component for injecting structured data
 * Renders a script tag with application/ld+json type
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
 * Multi-schema wrapper for injecting multiple JSON-LD blocks
 */
interface MultiJsonLdProps {
  schemas: Array<Record<string, unknown>>;
}

export function MultiJsonLd({ schemas }: MultiJsonLdProps) {
  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
