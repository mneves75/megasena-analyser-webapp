'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

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
    <section className="min-w-0 space-y-3">
      <h2>{title}</h2>
      <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words border-y border-border py-3 text-xs text-muted-foreground">
        {body}
      </pre>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleCopy()}
          aria-live="polite"
        >
          {copied ? copiedLabel : copyLabel}
        </Button>
        <a href={mailtoHref} className="min-w-0 break-all">
          {channel}
        </a>
      </div>
    </section>
  );
}
