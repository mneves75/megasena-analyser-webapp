import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import type { ArchiveState, DrawRecord } from '@/lib/api/archive-contract';
import type { BreadcrumbItem } from '@/lib/seo/schemas';
import { cn, formatDate } from '@/lib/utils';
import { countLabel, dezena, formatDateInBrasilia, frequencyBand } from '@/app/_lib/format';
import { Bar } from '@/components/figures';

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

const FREQUENCY_SHADES = [
  'bg-background',
  'bg-primary/10',
  'bg-primary/20',
  'bg-primary/35',
] as const;

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
  return <h1 className="text-balance text-4xl font-semibold sm:text-5xl">{children}</h1>;
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

/** Long-form reading pages (about, privacy, terms): measure, rhythm and hairline-ruled section heads. */
export const proseClass =
  'max-w-[68ch] space-y-6 break-words leading-7 [&_a:hover]:decoration-primary [&_a]:text-foreground [&_a]:underline [&_a]:decoration-border [&_a]:underline-offset-4 [&_h2]:text-balance [&_h2]:border-t [&_h2]:border-border [&_h2]:pt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:my-1 [&_li]:text-muted-foreground [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6';

export interface TermRow {
  term: string;
  detail: ReactNode;
}

/** Text definitions as ruled rows: the term left, its prose right (FactList is for figures). */
export function TermRows({ rows }: { rows: readonly TermRow[] }): React.JSX.Element {
  return (
    <dl className="divide-y divide-border border-t border-border text-sm">
      {rows.map((row) => (
        <div key={row.term} className="grid gap-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
          <dt className="font-medium text-foreground">{row.term}</dt>
          <dd className="text-muted-foreground">{row.detail}</dd>
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
    <h2 id={id} className="text-balance text-2xl font-semibold sm:text-3xl">
      {children}
    </h2>
  );
}

type TableName = { label: string; labelledBy?: never } | { labelledBy: string; label?: never };

/**
 * The ruled frame around a table. It is a named region in the tab order, so a
 * table wider than the screen can be scrolled from the keyboard; phones drop
 * low-value columns (wideCellClass) so the common tables fit without it.
 */
export function TableFrame({
  children,
  ...name
}: TableName & { children: ReactNode }): React.JSX.Element {
  return (
    <div
      role="region"
      aria-label={name.label}
      aria-labelledby={name.labelledBy}
      tabIndex={0}
      className={cn('overflow-x-auto border-y-2 border-y-primary bg-card', focusRing)}
    >
      {children}
    </div>
  );
}

export const tableClass = 'w-full border-collapse text-left text-sm';
/** A column phones drop: shown from `sm`. Put it on the head cell and every body cell. */
export const wideCellClass = 'hidden sm:table-cell';
/** Head cells sit on the tinted band, set in the condensed width. */
export const thClass = 'bg-tint px-4 py-2.5 font-condensed text-sm font-semibold text-foreground';
/** Body cells, including row headers (`<th scope="row">`). */
export const cellClass = 'border-t border-border px-4 py-2.5 tabular-nums';

/** Dezenas in dense tables: plain figures in fixed slots, the yearbook way. */
export function DezenaChips({ numbers }: { numbers: readonly number[] }): React.JSX.Element {
  return (
    <span className="flex gap-x-1.5 font-condensed text-base font-semibold sm:gap-x-2">
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
      <TableFrame label={caption}>
        <table className={tableClass}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className={thClass}>
                Concurso
              </th>
              <th scope="col" className={cn(thClass, wideCellClass)}>
                Data
              </th>
              <th scope="col" className={thClass}>
                Dezenas
              </th>
              <th scope="col" className={cn(thClass, wideCellClass, 'text-right')}>
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
                <td className={cn(cellClass, wideCellClass)}>{formatDate(draw.drawDate)}</td>
                <td className={cn(cellClass, 'whitespace-nowrap')}>
                  <DezenaChips numbers={draw.numbers} />
                </td>
                <td className={cn(cellClass, wideCellClass, 'text-right')}>
                  {draw.sena.winners === 0
                    ? 'Acumulou'
                    : countLabel(draw.sena.winners, 'ganhador', 'ganhadores')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
    </>
  );
}

/** All sixty numbers as a linked cartogram, stronger ink for numbers drawn more often. */
export function FrequencyGrid({
  entries,
  label,
}: {
  entries: readonly { number: number; frequency: number }[];
  label: string;
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
      <figcaption className="text-sm text-muted-foreground">
        Quanto mais forte a cor da casa, mais vezes a dezena foi sorteada.
      </figcaption>
    </figure>
  );
}

/** The page's one source line, set in its header beside the freshness statement. */
export function SourceLine({
  through,
}: {
  through?: number | null | undefined;
}): React.JSX.Element {
  return (
    <p className="text-sm text-muted-foreground">
      Fonte: CAIXA Econômica Federal{through ? `, concursos 1 a ${through}` : ''}.
    </p>
  );
}

export interface RankedEntry {
  number: number;
  /** Competition rank: tied values share a position, like the number pages. */
  rank: number;
  /** The measure itself (times drawn, draws absent), drawn as a bar when the list has one. */
  value: number;
  detail: string;
}

/**
 * Top `limit` entries by a score (higher first), with shared positions for ties.
 * `value` defaults to the score; pass it when the score is not the measure
 * (a least-drawn list ranks by the negated frequency).
 */
export function rankBy<T extends { number: number }>(
  limit: number,
  items: readonly T[],
  score: (item: T) => number,
  detail: (item: T) => string,
  value: (item: T) => number = score
): RankedEntry[] {
  const sorted = [...items].sort((a, b) => score(b) - score(a) || a.number - b.number);
  return sorted.slice(0, limit).map((item) => ({
    number: item.number,
    rank: 1 + sorted.filter((other) => score(other) > score(item)).length,
    value: value(item),
    detail: detail(item),
  }));
}

/**
 * Ranked numbers as ruled rows: position, linked dezena, measure. With `barMax`
 * each row also draws its value against that maximum; lists that share a
 * `barMax` are comparable bar for bar. Fixed columns keep every bar on the same
 * origin and length whatever the detail text.
 */
export function RankedList({
  labelId,
  entries,
  barMax,
}: {
  labelId: string;
  entries: readonly RankedEntry[];
  barMax?: number;
}): React.JSX.Element {
  if (barMax === undefined) {
    return (
      <ol aria-labelledby={labelId} className={rankedListClass}>
        {entries.map((entry) => (
          <li key={entry.number} className="flex items-center gap-3 py-2.5 text-sm">
            <RankedHead entry={entry} />
            <span className="ml-auto tabular-nums text-muted-foreground">{entry.detail}</span>
          </li>
        ))}
      </ol>
    );
  }
  // One grid for the whole list (rows are subgrids), so the detail column takes
  // the width of the longest detail and every bar gets the same track.
  return (
    <ol
      aria-labelledby={labelId}
      className={cn(rankedListClass, 'grid grid-cols-[1.5rem_auto_minmax(2rem,1fr)_auto]')}
    >
      {entries.map((entry) => (
        <li
          key={entry.number}
          className="col-span-4 grid grid-cols-subgrid items-center gap-x-3 py-2.5 text-sm"
        >
          <RankedHead entry={entry} />
          <Bar value={entry.value} max={barMax} />
          <span className="text-right tabular-nums text-muted-foreground">{entry.detail}</span>
        </li>
      ))}
    </ol>
  );
}

const rankedListClass = 'divide-y divide-border border-y-2 border-y-primary';

function RankedHead({ entry }: { entry: RankedEntry }): React.JSX.Element {
  return (
    <>
      <span className="w-6 text-right tabular-nums text-muted-foreground">{entry.rank}º</span>
      <ArchiveLink
        href={`/numeros/${entry.number}`}
        className={cn(inlineLinkClass, 'font-condensed text-base font-semibold')}
      >
        {dezena(entry.number)}
      </ArchiveLink>
    </>
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
