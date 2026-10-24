'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';
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
 * Storage disclosure rendered in the document flow, directly above the page.
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
      className="border-b border-border bg-muted/40"
    >
      <div className="container mx-auto flex items-start gap-3 px-4 py-3">
        <Shield aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-foreground">{pt.storageBanner.title}</p>
          <p className="text-xs text-muted-foreground">{pt.storageBanner.body}</p>
          <p className="text-xs text-muted-foreground">
            <Link
              href={pt.storageBanner.learnMoreHref}
              className="underline-offset-2 hover:underline"
            >
              {pt.storageBanner.learnMore}
            </Link>
            <span aria-hidden> · </span>
            <Link
              href={pt.storageBanner.rightsLinkHref}
              className="underline-offset-2 hover:underline"
            >
              {pt.storageBanner.rightsLink}
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={handleAccept}
          className="inline-flex shrink-0 items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {pt.storageBanner.accept}
        </button>
      </div>
    </div>
  );
}
