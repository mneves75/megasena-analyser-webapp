import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { ChevronRight, Info } from 'lucide-react';
import { LotteryBall } from '@/components/lottery-ball';
import type { ArchiveState, DrawRecord } from '@/lib/api/archive-contract';
import type { BreadcrumbItem } from '@/lib/seo/schemas';
import { cn, formatDate } from '@/lib/utils';
import { countLabel, dezena } from '@/app/_lib/format';

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

/** Standalone links (table cells, link rows): colour plus underline on hover. */
export const inlineLinkClass = cn(
  'rounded-sm font-medium text-primary underline-offset-4 hover:underline',
  focusRing
);

/** Links inside running text are always underlined (WCAG 1.4.1: not colour alone). */
export const textLinkClass = cn(
  'rounded-sm font-medium text-primary underline underline-offset-4',
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
                  <ArchiveLink
                    href={item.url}
                    className={cn('rounded-sm hover:text-foreground', focusRing)}
                  >
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

export function PageTitle({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <h1 className="text-balance font-title text-3xl font-bold tracking-tight sm:text-4xl">
      {children}
    </h1>
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
      // Unpadded so the accessible name contains the visible label (WCAG 2.5.3).
      aria-label={`Estatísticas do número ${number}`}
      className={cn('rounded-full', focusRing)}
    >
      <LotteryBall number={number} size={size} />
    </ArchiveLink>
  );
}

/** The first paragraph answers the page's query in plain words. */
export function AnswerSummary({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <p
      data-testid="answer-summary"
      className="max-w-[70ch] text-lg leading-relaxed text-foreground"
    >
      {children}
    </p>
  );
}

/** "Dados até o concurso N": the archive is refreshed periodically, not live. */
export function ArchiveFreshness({ archive }: { archive: ArchiveState }): React.JSX.Element | null {
  if (archive.lastContestNumber === null || archive.lastDrawDate === null) {
    return null;
  }
  return (
    <p className="text-sm text-muted-foreground">
      Dados até o concurso {archive.lastContestNumber} ({formatDate(archive.lastDrawDate)})
      {archive.lastModified ? `, base atualizada em ${formatDate(archive.lastModified.slice(0, 10))}` : ''}{' '}
      · resultados oficiais da CAIXA
    </p>
  );
}

export interface Fact {
  term: string;
  value: ReactNode;
  hint?: string;
}

export function FactList({ facts }: { facts: readonly Fact[] }): React.JSX.Element {
  // The 1px gaps are the border colour showing through, so every row must be
  // full: pick only column counts that divide the number of facts.
  const columns = cn(
    facts.length % 2 === 0 && 'sm:grid-cols-2',
    facts.length % 3 === 0 && 'lg:grid-cols-3'
  );
  return (
    <dl
      className={cn(
        'grid gap-px overflow-hidden rounded-xl border border-border bg-border',
        columns
      )}
    >
      {facts.map((fact) => (
        <div key={fact.term} className="flex flex-col gap-1 bg-card p-4">
          <dt className="text-sm text-muted-foreground">{fact.term}</dt>
          <dd className="font-title text-xl font-semibold tabular-nums">{fact.value}</dd>
          {fact.hint ? <dd className="text-xs text-muted-foreground">{fact.hint}</dd> : null}
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
  return <div className="overflow-x-auto rounded-xl border border-border bg-card">{children}</div>;
}

export const tableClass = 'w-full min-w-[32rem] border-collapse text-left text-sm';
export const thClass = 'px-4 py-3 font-medium text-muted-foreground';
/** Body cells, including row headers (`<th scope="row">`). */
export const cellClass = 'border-t border-border px-4 py-3 tabular-nums';

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

/** One row per draw, newest first, each linking to its page. */
export function DrawsTable({
  caption,
  draws,
}: {
  caption: string;
  draws: readonly DrawRecord[];
}): React.JSX.Element {
  return (
    <TableFrame>
      <table className={tableClass}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={thClass}>Concurso</th>
            <th scope="col" className={thClass}>Data</th>
            <th scope="col" className={thClass}>Dezenas</th>
            <th scope="col" className={thClass}>Sena</th>
          </tr>
        </thead>
        <tbody>
          {draws.map((draw) => (
            <tr key={draw.contestNumber}>
              <th scope="row" className={cellClass}>
                <ArchiveLink href={`/concurso/${draw.contestNumber}`} className={inlineLinkClass}>
                  {draw.contestNumber}
                </ArchiveLink>
              </th>
              <td className={cellClass}>{formatDate(draw.drawDate)}</td>
              <td className={cellClass}>
                <DezenaChips numbers={draw.numbers} />
              </td>
              <td className={cellClass}>
                {draw.sena.winners === 0
                  ? 'Acumulou'
                  : countLabel(draw.sena.winners, 'ganhador', 'ganhadores')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

export function RandomnessNote({ children }: { children?: ReactNode }): React.JSX.Element {
  return (
    <aside className="flex max-w-[75ch] items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
      <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        {children ??
          'A Mega-Sena é aleatória: cada concurso é independente e nenhum dado histórico prevê o próximo resultado.'}{' '}
        <Link href="/about" className={textLinkClass}>
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
