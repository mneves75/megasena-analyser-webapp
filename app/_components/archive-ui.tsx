import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { ChevronRight, Info } from 'lucide-react';
import { LotteryBall } from '@/components/lottery-ball';
import { MultiJsonLd } from '@/components/seo/json-ld';
import { cn } from '@/lib/utils';
import {
  generateBreadcrumbSchema,
  generateWebPageSchema,
  type BreadcrumbItem,
} from '@/lib/seo/schemas';
import { dezena } from '@/app/_lib/format';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Link into an archive route (/resultados, /concurso, /numeros). Prefetch is off:
 * these pages have no loading boundary, so a viewport prefetch renders the whole
 * page and spends one API call of the visitor's quota per visible link.
 */
export function ArchiveLink(props: Omit<ComponentProps<typeof Link>, 'prefetch'>): React.JSX.Element {
  return <Link {...props} prefetch={false} />;
}

export const inlineLinkClass = cn(
  'rounded-sm font-medium text-primary underline-offset-4 hover:underline',
  focusRing
);

/** Visible trail; the same items feed the BreadcrumbList JSON-LD. */
export function Breadcrumbs({ items }: { items: readonly BreadcrumbItem[] }): React.JSX.Element {
  return (
    <nav aria-label="Trilha de navegação" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.url} className="flex items-center gap-1">
              {isLast ? (
                <span aria-current="page" className="text-foreground">
                  {item.name}
                </span>
              ) : (
                <>
                  <ArchiveLink href={item.url} className={cn('rounded-sm hover:text-foreground', focusRing)}>
                    {item.name}
                  </ArchiveLink>
                  <ChevronRight aria-hidden className="h-3.5 w-3.5" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface PageStructuredDataProps {
  path: string;
  name: string;
  description: string;
  breadcrumbs: BreadcrumbItem[];
  type?: 'WebPage' | 'CollectionPage';
  datePublished?: string;
  dateModified?: string;
  extra?: Array<Record<string, unknown>>;
}

export function PageStructuredData({
  path,
  name,
  description,
  breadcrumbs,
  type,
  datePublished,
  dateModified,
  extra = [],
}: PageStructuredDataProps): React.JSX.Element {
  return (
    <MultiJsonLd
      schemas={[
        generateWebPageSchema({
          path,
          name,
          description,
          ...(type ? { type } : {}),
          ...(datePublished ? { datePublished } : {}),
          ...(dateModified ? { dateModified } : {}),
        }),
        generateBreadcrumbSchema(breadcrumbs, path),
        ...extra,
      ]}
    />
  );
}

export function NumberBallLink({
  number,
  size = 'md',
}: {
  number: number;
  size?: 'sm' | 'md' | 'lg';
}): React.JSX.Element {
  return (
    <ArchiveLink
      href={`/numeros/${number}`}
      aria-label={`Estatísticas do número ${dezena(number)}`}
      className={cn('rounded-full', focusRing)}
    >
      <LotteryBall number={number} size={size} />
    </ArchiveLink>
  );
}

/** The first paragraph answers the page's query in plain words. */
export function AnswerSummary({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <p data-testid="answer-summary" className="max-w-[70ch] text-lg leading-relaxed text-foreground">
      {children}
    </p>
  );
}

export interface Fact {
  term: string;
  value: ReactNode;
  hint?: string;
}

export function FactList({ facts }: { facts: readonly Fact[] }): React.JSX.Element {
  return (
    <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
      {facts.map((fact) => (
        <div key={fact.term} className="flex flex-col gap-1 bg-card p-4">
          <dt className="text-sm text-muted-foreground">{fact.term}</dt>
          <dd className="font-title text-xl font-semibold tabular-nums">{fact.value}</dd>
          {fact.hint ? <p className="text-xs text-muted-foreground">{fact.hint}</p> : null}
        </div>
      ))}
    </dl>
  );
}

export function SectionHeading({ id, children }: { id: string; children: ReactNode }): React.JSX.Element {
  return (
    <h2 id={id} className="text-balance font-title text-xl font-semibold tracking-tight sm:text-2xl">
      {children}
    </h2>
  );
}

export function TableFrame({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      {children}
    </div>
  );
}

export const tableClass = 'w-full min-w-[32rem] border-collapse text-left text-sm';
export const thClass = 'px-4 py-3 font-medium text-muted-foreground';
export const tdClass = 'border-t border-border px-4 py-3 tabular-nums';

export function RandomnessNote({ children }: { children?: ReactNode }): React.JSX.Element {
  return (
    <aside className="flex max-w-[75ch] items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
      <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        {children ??
          'A Mega-Sena é aleatória: cada concurso é independente e nenhum dado histórico prevê o próximo resultado.'}{' '}
        <Link href="/about" className={inlineLinkClass}>
          Como os dados são calculados
        </Link>
      </p>
    </aside>
  );
}

interface PagerLink {
  href: string;
  label: string;
  detail: string;
}

export function Pager({
  previous,
  next,
  label,
}: {
  previous: PagerLink | null;
  next: PagerLink | null;
  label: string;
}): React.JSX.Element {
  const linkClass = cn(
    'flex min-h-11 flex-col rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-accent',
    focusRing
  );
  return (
    <nav aria-label={label} className="grid gap-3 sm:grid-cols-2">
      {previous ? (
        <ArchiveLink href={previous.href} className={linkClass}>
          <span className="text-xs text-muted-foreground">← {previous.label}</span>
          <span className="font-medium tabular-nums">{previous.detail}</span>
        </ArchiveLink>
      ) : (
        <span aria-hidden />
      )}
      {next ? (
        <ArchiveLink href={next.href} className={cn(linkClass, 'sm:items-end sm:text-right')}>
          <span className="text-xs text-muted-foreground">{next.label} →</span>
          <span className="font-medium tabular-nums">{next.detail}</span>
        </ArchiveLink>
      ) : null}
    </nav>
  );
}

/** Compact, non-interactive dezenas for dense tables (no client JS per ball). */
export function DezenaChips({ numbers }: { numbers: readonly number[] }): React.JSX.Element {
  return (
    <span className="flex flex-wrap gap-1">
      {numbers.map((number) => (
        <span
          key={number}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-foreground"
        >
          {dezena(number)}
        </span>
      ))}
    </span>
  );
}
