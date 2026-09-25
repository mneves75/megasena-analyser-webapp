import { MultiJsonLd } from '@/components/seo/json-ld';
import {
  generateBreadcrumbSchema,
  generateWebPageSchema,
  type BreadcrumbItem,
  type JsonLdNode,
} from '@/lib/seo/schemas';

interface PageJsonLdProps {
  path: string;
  name: string;
  description: string;
  type?: 'WebPage' | 'CollectionPage';
  /** Only pass a trail the page also shows, or one that mirrors its URL hierarchy. */
  breadcrumbs?: BreadcrumbItem[];
  datePublished?: string;
  dateModified?: string;
  /** Other nodes about this page (FAQPage, Dataset), emitted in the same @graph. */
  extra?: JsonLdNode[];
}

/**
 * The page's own node in the site graph: a WebPage/CollectionPage linked to the
 * WebSite and Organization emitted by the root layout, plus its breadcrumbs.
 */
export function PageJsonLd({
  path,
  name,
  description,
  type,
  breadcrumbs,
  datePublished,
  dateModified,
  extra = [],
}: PageJsonLdProps): React.JSX.Element {
  return (
    <MultiJsonLd
      schemas={[
        generateWebPageSchema({
          path,
          name,
          description,
          hasBreadcrumb: breadcrumbs !== undefined,
          ...(type ? { type } : {}),
          ...(datePublished ? { datePublished } : {}),
          ...(dateModified ? { dateModified } : {}),
        }),
        ...(breadcrumbs ? [generateBreadcrumbSchema(breadcrumbs, path)] : []),
        ...extra,
      ]}
    />
  );
}
