'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pt } from '@/lib/i18n';

const STORAGE_KEY = 'megasena-privacy-ack';
const STORAGE_VERSION = '2026-05-20';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {
      /* noop */
    };
  }
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getClientSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function getServerSnapshot(): string {
  return STORAGE_VERSION;
}

/**
 * Storage disclosure rendered in the document flow, between the header and
 * the page: one line (the short statement and the button), with the
 * key-by-key text and the links inside a native disclosure.
 *
 * It used to be a fixed bottom bar, which sat on top of the generator's submit
 * button and the home hero's last-draw numbers until the visitor dismissed it.
 * In flow it pushes the page down instead of covering a control, which is the
 * only placement that holds at every breakpoint and zoom level.
 */
export function StorageDisclosure(): React.ReactElement | null {
  const ack = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || ack === STORAGE_VERSION) {
    return null;
  }

  const handleAccept = (): void => {
    try {
      window.localStorage.setItem(STORAGE_KEY, STORAGE_VERSION);
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    } catch {
      // Storage may be blocked; dismiss in-memory regardless.
    }
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label={pt.storageBanner.ariaLabel}
      className="border-b border-border bg-tint"
    >
      <div className="page flex items-start gap-3 py-1.5">
        <details className="group min-w-0 flex-1 text-sm">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm focus-ring focus-visible:ring-offset-tint [&::-webkit-details-marker]:hidden">
            <span>
              <span className="font-semibold text-foreground">{pt.storageBanner.title}.</span>{' '}
              <span className="text-muted-foreground">{pt.storageBanner.summary}</span>
            </span>
            <ChevronDown
              aria-hidden
              className="h-4 w-4 shrink-0 text-primary transition-transform duration-200 ease-out-quint group-open:rotate-180"
            />
          </summary>
          <div className="max-w-[68ch] space-y-1 pb-3 text-xs text-muted-foreground">
            <p>{pt.storageBanner.body}</p>
            <p>
              <Link
                href={pt.storageBanner.learnMoreHref}
                className="focus-ring rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:ring-offset-tint"
              >
                {pt.storageBanner.learnMore}
              </Link>
              <span aria-hidden> · </span>
              <Link
                href={pt.storageBanner.rightsLinkHref}
                className="focus-ring rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:ring-offset-tint"
              >
                {pt.storageBanner.rightsLink}
              </Link>
            </p>
          </div>
        </details>
        <Button size="sm" onClick={handleAccept} className="shrink-0">
          {pt.storageBanner.accept}
        </Button>
      </div>
    </div>
  );
}
