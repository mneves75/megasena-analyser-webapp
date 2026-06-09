'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Shield, X } from 'lucide-react';
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
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85"
    >
      <div className="container mx-auto flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Shield aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {pt.storageBanner.title}
            </p>
            <p className="text-sm text-muted-foreground">{pt.storageBanner.body}</p>
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
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={handleAccept}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {pt.storageBanner.accept}
          </button>
          <button
            type="button"
            aria-label={pt.storageBanner.accept}
            onClick={handleAccept}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 md:hidden"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
