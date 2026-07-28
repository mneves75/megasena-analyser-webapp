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
    let observer: IntersectionObserver | undefined;

    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
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
        .forEach((element) => observer!.observe(element));
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="Seções da análise"
      className="sticky top-[var(--app-header-height,4rem)] z-30 -mx-4 border-b border-border/60 bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70"
    >
      <ul className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => {
          const isActive = section.id === activeId;
          return (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-smooth',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
