import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import type { ArchiveState, DrawRecord } from '@/lib/api/archive-contract';
import type { BreadcrumbItem } from '@/lib/seo/schemas';
import { cn, formatDate } from '@/lib/utils';
import { countLabel, dezena, formatDateInBrasilia, frequencyBand } from '@/app/_lib/format';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Link into an archive route (/resultados, /concurso, /numeros). Prefetch is off:
 * these pages have no loading boundary, so a viewport prefetch renders the whole
 * page and spends one API call of the visitor's quota per visible link.
 */
export function ArchiveLink(
  props: Omit<ComponentProps<typeof Link>, 'prefetch'>
): React.JSX.Element {
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

const FREQUENCY_SHADES = ['bg-card', 'bg-primary/10', 'bg-primary/20', 'bg-primary/35'] as const;

/** Cartogram cell shade: darker for numbers drawn more often within [min, max]. */
export function frequencyShadeClass(value: number, min: number, max: number): string {
  return FREQUENCY_SHADES[frequencyBand(value, min, max)];
}

/** Visible trail; the same items feed the BreadcrumbList JSON-LD. */
export function Breadcrumbs({ items }: { items: readonly BreadcrumbItem[] }): React.JSX.Element {
  return (
    <nav
      aria-label="Trilha de navegação"
      className="border-b border-border pb-2 text-sm text-muted-foreground"
    >
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.url} className="flex items-center gap-2">
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
                  <span aria-hidden className="text-border">
                    /
                  </span>
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
  return <h1 className="text-balance font-title text-4xl font-semibold sm:text-5xl">{children}</h1>;
}

/** The first paragraph answers the page's query in plain words. */
export function AnswerSummary({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <p
      data-testid="answer-summary"
      className="max-w-[68ch] text-lg leading-relaxed text-foreground"
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
      Fonte: CAIXA Econômica Federal. Dados até o concurso {archive.lastContestNumber} (
      {formatDate(archive.lastDrawDate)})
      {archive.lastModified
        ? `, base atualizada em ${formatDateInBrasilia(archive.lastModified)}`
        : ''}
      .
    </p>
  );
}

export interface Fact {
  term: string;
  value: ReactNode;
  hint?: string;
}

/** Facts as ruled table rows: the term (and its note) left, the figure right. */
export function FactList({ facts }: { facts: readonly Fact[] }): React.JSX.Element {
  return (
    <dl className="max-w-3xl divide-y divide-border border-y-2 border-y-primary">
      {facts.map((fact) => (
        <div
          key={fact.term}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 py-3"
        >
          <dt className="text-sm text-muted-foreground">
            {fact.term}
            {fact.hint ? <span className="mt-0.5 block text-xs">{fact.hint}</span> : null}
          </dt>
          <dd className="text-right font-condensed text-xl font-semibold tabular-nums">
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <h2 id={id} className="text-balance font-title text-2xl font-semibold sm:text-3xl">
      {children}
    </h2>
  );
}

export function TableFrame({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="overflow-x-auto border-y-2 border-y-primary bg-card">{children}</div>;
}

export const tableClass = 'w-full min-w-[32rem] border-collapse text-left text-sm';
/** Head cells sit on the tinted band, set in the condensed width. */
export const thClass = 'bg-tint px-4 py-2.5 font-condensed text-sm font-semibold text-foreground';
/** Body cells, including row headers (`<th scope="row">`). */
export const cellClass = 'border-t border-border px-4 py-2.5 tabular-nums';

/** Dezenas in dense tables: plain figures in fixed slots, the yearbook way. */
export function DezenaChips({ numbers }: { numbers: readonly number[] }): React.JSX.Element {
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-1 font-condensed text-base font-semibold">
      {numbers.map((number) => (
        <span key={number} className="w-6 text-center tabular-nums">
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
    <>
      <TableFrame>
        <table className={tableClass}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className={thClass}>
                Concurso
              </th>
              <th scope="col" className={thClass}>
                Data
              </th>
              <th scope="col" className={thClass}>
                Dezenas
              </th>
              <th scope="col" className={thClass}>
                Sena
              </th>
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
      <SourceLine />
    </>
  );
}

/** All sixty numbers as a linked cartogram, darker for numbers drawn more often. */
export function FrequencyGrid({
  entries,
  label,
  through,
}: {
  entries: readonly { number: number; frequency: number }[];
  label: string;
  through?: number | null | undefined;
}): React.JSX.Element {
  const frequencies = entries.map((entry) => entry.frequency);
  const min = Math.min(...frequencies);
  const max = Math.max(...frequencies);
  return (
    <figure className="space-y-3">
      <ul
        aria-label={label}
        className="grid grid-cols-5 border-l border-t border-border sm:grid-cols-10"
      >
        {entries.map((entry) => (
          <li key={entry.number} className="border-b border-r border-border">
            <ArchiveLink
              href={`/numeros/${entry.number}`}
              className={cn(
                'flex flex-col items-center gap-0.5 py-3 transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                frequencyShadeClass(entry.frequency, min, max)
              )}
            >
              <span className="font-condensed text-xl font-semibold tabular-nums">
                {dezena(entry.number)}
              </span>
              <span className="text-xs tabular-nums">
                {countLabel(entry.frequency, 'vez', 'vezes')}
              </span>
            </ArchiveLink>
          </li>
        ))}
      </ul>
      <figcaption className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Quanto mais escura a casa, mais vezes a dezena foi sorteada.
        </p>
        <SourceLine through={through} />
      </figcaption>
    </figure>
  );
}

/** The yearbook's source line under a table or figure. */
export function SourceLine({
  through,
}: {
  through?: number | null | undefined;
}): React.JSX.Element {
  return (
    <p className="text-xs text-muted-foreground">
      Fonte: CAIXA Econômica Federal{through ? `, concursos 1 a ${through}` : ''}.
    </p>
  );
}

export interface RankedEntry {
  number: number;
  /** Competition rank: tied values share a position, like the number pages. */
  rank: number;
  detail: string;
}

/** Top `limit` entries by a score (higher first), with shared positions for ties. */
export function rankBy<T extends { number: number }>(
  limit: number,
  items: readonly T[],
  score: (item: T) => number,
  detail: (item: T) => string
): RankedEntry[] {
  const sorted = [...items].sort((a, b) => score(b) - score(a) || a.number - b.number);
  return sorted.slice(0, limit).map((item) => ({
    number: item.number,
    rank: 1 + sorted.filter((other) => score(other) > score(item)).length,
    detail: detail(item),
  }));
}

/** Ranked numbers as ruled rows: position, linked dezena, measure. */
export function RankedList({
  labelId,
  entries,
}: {
  labelId: string;
  entries: readonly RankedEntry[];
}): React.JSX.Element {
  return (
    <ol aria-labelledby={labelId} className="divide-y divide-border border-y-2 border-y-primary">
      {entries.map((entry) => (
        <li key={entry.number} className="flex items-center gap-3 py-2.5 text-sm">
          <span className="w-6 text-right tabular-nums text-muted-foreground">{entry.rank}º</span>
          <ArchiveLink
            href={`/numeros/${entry.number}`}
            className={cn(inlineLinkClass, 'font-condensed text-base font-semibold')}
          >
            {dezena(entry.number)}
          </ArchiveLink>
          <span className="ml-auto tabular-nums text-muted-foreground">{entry.detail}</span>
        </li>
      ))}
    </ol>
  );
}

export function RandomnessNote({ children }: { children?: ReactNode }): React.JSX.Element {
  return (
    <aside className="max-w-[68ch] border-t border-border pt-3 text-sm text-muted-foreground">
      <p>
        <span className="font-semibold text-foreground">Nota. </span>
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
    'flex min-h-11 flex-col rounded-sm py-3 transition-colors hover:text-primary',
    focusRing
  );
  return (
    <nav aria-label={label} className="grid gap-3 border-t-2 border-primary sm:grid-cols-2">
      {previous ? (
        <ArchiveLink href={previous.href} className={linkClass}>
          <span className="text-xs text-muted-foreground">{previous.label}</span>
          <span className="font-condensed text-xl font-semibold tabular-nums">
            {previous.detail}
          </span>
        </ArchiveLink>
      ) : (
        <span aria-hidden />
      )}
      {next ? (
        <ArchiveLink href={next.href} className={cn(linkClass, 'sm:items-end sm:text-right')}>
          <span className="text-xs text-muted-foreground">{next.label}</span>
          <span className="font-condensed text-xl font-semibold tabular-nums">{next.detail}</span>
        </ArchiveLink>
      ) : null}
    </nav>
  );
}
