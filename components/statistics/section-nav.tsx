'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface StatisticsSection {
  id: string;
  label: string;
}

interface SectionNavProps {
  sections: StatisticsSection[];
}

/**
 * Sticky, horizontally scrollable section index for the statistics page.
 * Scrollspy is progressive enhancement only: the observer merely highlights the
 * section in view. All page content is server-rendered and visible without JS.
 */
export function SectionNav({ sections }: SectionNavProps): React.ReactNode {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      // Bias the active line toward the section crossing the upper third.
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );

    sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null)
      .forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="Seções da análise"
      className="sticky top-[var(--app-header-height,4rem)] z-30 -mx-4 border-b border-border bg-background px-4"
    >
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => {
          const isActive = section.id === activeId;
          return (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
