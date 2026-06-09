'use client';

import { useState } from 'react';
import { Check, Copy, Mail } from 'lucide-react';

interface RightsRequestTemplateProps {
  title: string;
  body: string;
  copyLabel: string;
  copiedLabel: string;
  channel: string;
}

const COPY_RESET_MS = 2_000;

export function RightsRequestTemplate({
  title,
  body,
  copyLabel,
  copiedLabel,
  channel,
}: RightsRequestTemplateProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPY_RESET_MS);
    } catch {
      setCopied(false);
    }
  };

  const mailtoHref = `mailto:${channel}?subject=${encodeURIComponent(
    'Solicitação LGPD'
  )}&body=${encodeURIComponent(body)}`;

  return (
    <section className="not-prose my-8 min-w-0 rounded-lg border border-muted bg-card/50 p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-live="polite"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {copied ? (
              <>
                <Check aria-hidden className="h-3.5 w-3.5 text-primary" />
                {copiedLabel}
              </>
            ) : (
              <>
                <Copy aria-hidden className="h-3.5 w-3.5" />
                {copyLabel}
              </>
            )}
          </button>
          <a
            href={mailtoHref}
            className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <Mail aria-hidden className="h-3.5 w-3.5" />
            <span className="min-w-0 break-all">{channel}</span>
          </a>
        </div>
      </div>
      <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted/40 p-4 text-xs text-muted-foreground">
        {body}
      </pre>
    </section>
  );
}
