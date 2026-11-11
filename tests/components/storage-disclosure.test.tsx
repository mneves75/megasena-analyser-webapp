import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { StorageDisclosure } from '@/components/storage-disclosure';
import { pt } from '@/lib/i18n';

/*
 * LGPD: the band must still name every localStorage key with the same wording
 * for what is stored and why. Only the layout changed: one line, with the
 * key-by-key text inside a native disclosure.
 */
describe('StorageDisclosure', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('is one named region: a short statement, a closed disclosure and the button', () => {
    const { container } = render(<StorageDisclosure />);
    const region = screen.getByRole('region', { name: pt.storageBanner.ariaLabel });
    const details = region.querySelector('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    const summary = details?.querySelector('summary');
    expect(summary).toHaveTextContent(pt.storageBanner.title);
    expect(summary).toHaveTextContent(pt.storageBanner.summary);
    expect(within(region).getByRole('button', { name: pt.storageBanner.accept })).toBeVisible();
    expect(container.querySelectorAll('[role="region"] > .page')).toHaveLength(1);
  });

  it('keeps the key-by-key text and both links, unchanged, inside the disclosure', () => {
    render(<StorageDisclosure />);
    const details = screen.getByRole('region').querySelector('details') as HTMLElement;
    expect(details).toHaveTextContent(pt.storageBanner.body);
    expect(pt.storageBanner.body).toContain('megasena-theme (preferência de tema)');
    expect(pt.storageBanner.body).toContain(
      'megasena-privacy-ack (versão deste aviso já visualizada, para não exibi-lo novamente)'
    );
    expect(within(details).getByRole('link', { name: pt.storageBanner.learnMore })).toHaveAttribute(
      'href',
      '/privacy'
    );
    expect(
      within(details).getByRole('link', { name: pt.storageBanner.rightsLink })
    ).toHaveAttribute('href', '/privacy/direitos');
  });

  it('gives both links the shared focus ring, offset from the tinted band', () => {
    render(<StorageDisclosure />);
    for (const name of [pt.storageBanner.learnMore, pt.storageBanner.rightsLink]) {
      const link = screen.getByRole('link', { name });
      expect(link.className).toMatch(/\bfocus-ring\b/);
      expect(link.className).toContain('focus-visible:ring-offset-tint');
    }
  });

  it('uses the shared Button and records the acknowledgement', () => {
    render(<StorageDisclosure />);
    const button = screen.getByRole('button', { name: pt.storageBanner.accept });
    // The shared Button's base classes (components/ui/button.tsx).
    expect(button.className).toContain('min-h-11');
    expect(button.className).toContain('rounded-sm');
    expect(button.className).toContain('px-3');
    expect(button.className).toContain('hover:bg-primary/85');
    fireEvent.click(button);
    expect(window.localStorage.getItem('megasena-privacy-ack')).toBe('2026-05-20');
    expect(screen.queryByRole('region')).toBeNull();
  });
});
