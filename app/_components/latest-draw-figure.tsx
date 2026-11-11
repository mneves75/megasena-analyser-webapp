import type { ReactNode } from 'react';
import { NumberField } from '@/components/number-field';

/**
 * A draw as the yearbook shows it: the caller's heading and facts on the left,
 * the field of sixty on the right from `lg`, stacked below. The caller passes
 * the heading element, so each page keeps its own outline (h1 on a draw page,
 * h2 where the draw is one section of many).
 *
 * Kept out of archive-ui: client components import that module, and the field
 * of sixty must not ship to the browser.
 */
export function LatestDrawFigure({
  heading,
  numbers,
  fieldLabel,
  children,
}: {
  heading: ReactNode;
  numbers: readonly number[];
  fieldLabel: string;
  children?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 items-start gap-8 border-t-2 border-primary pt-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <div className="space-y-4">
        {heading}
        {children}
      </div>
      <NumberField struck={numbers} linked size="lg" label={fieldLabel} />
    </div>
  );
}
