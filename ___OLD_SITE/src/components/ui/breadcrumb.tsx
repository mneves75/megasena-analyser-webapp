import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon, HomeIcon } from "@heroicons/react/24/outline";

import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  showHome?: boolean;
  separator?: React.ReactNode;
}

const Breadcrumb = React.forwardRef<HTMLElement, BreadcrumbProps>(
  (
    {
      className,
      items,
      showHome = true,
      separator = <ChevronRightIcon className="h-4 w-4 text-slate-400" />,
      ...props
    },
    ref,
  ) => {
    const allItems = showHome
      ? [{ label: "Início", href: "/" }, ...items]
      : items;

    return (
      <nav
        ref={ref}
        className={cn("flex items-center space-x-2", className)}
        aria-label="Breadcrumb"
        {...props}
      >
        <ol className="flex items-center space-x-2">
          {allItems.map((item, index) => {
            const isLast = index === allItems.length - 1;
            const isCurrent = item.current || isLast;

            return (
              <li key={index} className="flex items-center">
                {index > 0 && (
                  <span className="mx-2" aria-hidden="true">
                    {separator}
                  </span>
                )}
                {item.href && !isCurrent ? (
                  <Link
                    href={item.href}
                    className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors duration-150"
                  >
                    {index === 0 && showHome && (
                      <HomeIcon className="h-4 w-4 mr-1 inline" />
                    )}
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isCurrent
                        ? "text-slate-900 dark:text-white"
                        : "text-slate-500 dark:text-slate-400",
                    )}
                    aria-current={isCurrent ? "page" : undefined}
                  >
                    {index === 0 && showHome && (
                      <HomeIcon className="h-4 w-4 mr-1 inline" />
                    )}
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  },
);

Breadcrumb.displayName = "Breadcrumb";

export { Breadcrumb };
