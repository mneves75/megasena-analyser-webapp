import Link from 'next/link';
import { cn } from '@/lib/utils';

const ALL_NUMBERS = Array.from({ length: 60 }, (_, index) => index + 1);

const dezena = (number: number): string => String(number).padStart(2, '0');

// Struck discs land in draw order; class names, not inline styles, under the CSP.
const STRIKE_DELAYS = [
  '[animation-delay:0ms]',
  '[animation-delay:60ms]',
  '[animation-delay:120ms]',
  '[animation-delay:180ms]',
  '[animation-delay:240ms]',
  '[animation-delay:300ms]',
] as const;

interface NumberFieldProps {
  /** Drawn or selected numbers, struck in ink. */
  struck: readonly number[];
  /** One number ringed for reference, e.g. the number a page is about. */
  ringed?: number;
  /** Struck numbers link to their number page. */
  linked?: boolean;
  /** Read by assistive technology in place of the sixty cells. */
  label: string;
  size?: 'md' | 'lg';
  className?: string;
}

/**
 * The full field of sixty, laid out like the volante (ten per row), with the
 * struck numbers filled. Every draw is shown against everything it could have
 * been. Only struck and ringed cells reach assistive technology.
 */
export function NumberField({
  struck,
  ringed,
  linked = false,
  label,
  size = 'md',
  className,
}: NumberFieldProps): React.JSX.Element {
  const order = new Map([...struck].sort((a, b) => a - b).map((number, index) => [number, index]));

  return (
    <ol
      aria-label={label}
      className={cn(
        '@container grid grid-cols-10 border-l border-t border-border font-condensed tabular-nums',
        size === 'lg' ? 'max-w-3xl' : 'max-w-xl',
        className
      )}
    >
      {ALL_NUMBERS.map((number) => {
        const strikeIndex = order.get(number);
        const isStruck = strikeIndex !== undefined;
        const isRinged = number === ringed;
        const exposed = isStruck || isRinged;
        const mark = (
          <span
            className={cn(
              'flex aspect-square w-full items-center justify-center rounded-full',
              isStruck
                ? cn(
                    'number-field-strike bg-primary font-semibold text-primary-foreground',
                    STRIKE_DELAYS[Math.min(strikeIndex, STRIKE_DELAYS.length - 1)]
                  )
                : 'text-muted-foreground',
              isRinged && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
              isRinged && !isStruck && 'font-semibold text-foreground'
            )}
          >
            {dezena(number)}
          </span>
        );

        return (
          <li
            key={number}
            aria-hidden={exposed ? undefined : true}
            // Figures scale with the cell: a tenth of the field's width.
            className="border-b border-r border-border bg-card p-[12%] text-[clamp(0.75rem,3.4cqw,1.375rem)]"
          >
            {isStruck && linked ? (
              <Link
                href={`/numeros/${number}`}
                prefetch={false}
                aria-label={`Dezena ${dezena(number)}: estatísticas`}
                className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                {mark}
              </Link>
            ) : (
              mark
            )}
          </li>
        );
      })}
    </ol>
  );
}
