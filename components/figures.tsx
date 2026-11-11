import { cn } from '@/lib/utils';

/*
 * The yearbook's plates: figures drawn in the one ink, on the server, as SVG.
 * Geometry lives in SVG attributes and colour in token classes, so no `style`
 * attribute reaches the HTML (the CSP has no `style-src-attr` exception) and no
 * JavaScript reaches the browser. Shapes stretch with their box; text never sits
 * inside the SVG, so labels keep their size on a phone.
 *
 * Every <svg> here takes its shapes as one markup string, never as React
 * children. React streams a large page in pieces, and a piece that starts
 * inside an <svg> is sent as `<svg style="display:none">`, which the CSP
 * refuses. With no element children there is no place inside the SVG to split.
 * The strings are built only from numbers (through `n`) and fixed class names.
 */

/** A finite number as an SVG attribute value; anything else draws as zero. */
export function n(value: number): string {
  return Number.isFinite(value) ? String(value) : '0';
}

/** A value drawn against the largest in its column. The number itself is in the row. */
export function Bar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}): React.JSX.Element {
  const width = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 1"
      preserveAspectRatio="none"
      className={cn('block h-1.5 w-full', className)}
      dangerouslySetInnerHTML={{
        __html:
          '<rect width="100" height="1" class="fill-border"></rect>' +
          `<rect width="${n(width)}" height="1" class="fill-primary"></rect>`,
      }}
    />
  );
}

export interface Column {
  /** Category under the column ("3 / 3", "01"). Empty leaves the slot unlabelled. */
  label: string;
  value: number;
  /** The figure under the label ("31,2%"). */
  detail?: string;
}

const PLOT_HEIGHT = 100;
const SLOT = 10;
const GAP = 2;

/**
 * A distribution as columns from a zero baseline. `reference` draws a dashed
 * line across the plot (an expected value) and is explained under the figure.
 * The plot is one image for assistive technology, named by `label`; the same
 * numbers stay available in the table or list next to it.
 */
export function Columns({
  columns,
  reference,
  label,
  className,
}: {
  columns: readonly Column[];
  reference?: { value: number; label: string };
  label: string;
  className?: string;
}): React.JSX.Element {
  const width = columns.length * SLOT;
  const max = Math.max(reference?.value ?? 0, ...columns.map((column) => column.value));
  const scale = (value: number): number => (max > 0 ? (value / max) * PLOT_HEIGHT : 0);
  const hasLabels = columns.some((column) => column.label !== '');

  const bars = columns
    .map((column, index) => {
      const height = scale(column.value);
      return `<rect x="${n(index * SLOT + GAP / 2)}" y="${n(PLOT_HEIGHT - height)}" width="${n(SLOT - GAP)}" height="${n(height)}" class="fill-primary"></rect>`;
    })
    .join('');
  const referenceY = reference ? n(PLOT_HEIGHT - scale(reference.value)) : null;
  const referenceLine =
    referenceY === null
      ? ''
      : `<line x1="0" x2="${n(width)}" y1="${referenceY}" y2="${referenceY}" vector-effect="non-scaling-stroke" stroke-dasharray="4 3" class="stroke-foreground stroke-1"></line>`;

  return (
    <figure className={cn('space-y-2', className)}>
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${width} ${PLOT_HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-40 w-full border-b border-foreground sm:h-48"
        dangerouslySetInnerHTML={{ __html: bars + referenceLine }}
      />
      {hasLabels ? (
        <ol aria-hidden="true" className="flex">
          {columns.map((column, index) => (
            <li key={index} className="min-w-0 flex-1 basis-0 text-center">
              <span className="block font-condensed text-sm font-semibold tabular-nums">
                {column.label}
              </span>
              {column.detail ? (
                <span className="block text-xs tabular-nums text-muted-foreground">
                  {column.detail}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {reference ? (
        <figcaption className="flex items-center gap-2 text-xs text-muted-foreground">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 2"
            className="h-0.5 w-6"
            dangerouslySetInnerHTML={{
              __html:
                '<line x1="0" x2="24" y1="1" y2="1" stroke-dasharray="4 3" class="stroke-foreground stroke-2"></line>',
            }}
          />
          {reference.label}
        </figcaption>
      ) : null}
    </figure>
  );
}
