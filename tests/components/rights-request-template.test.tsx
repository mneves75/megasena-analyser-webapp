import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RightsRequestTemplate } from '@/components/privacy/rights-request-template';

const props = {
  title: 'Modelo de solicitação',
  body: 'Assunto: Solicitação LGPD\nOlá & obrigado',
  copyLabel: 'Copiar modelo',
  copiedLabel: 'Modelo copiado',
  channel: 'privacidade@example.com',
};

describe('RightsRequestTemplate', () => {
  it('copies the template body and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<RightsRequestTemplate {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copiar modelo' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Modelo copiado' })).toBeVisible()
    );
    expect(writeText).toHaveBeenCalledWith(props.body);
  });

  it('keeps the copy label when the clipboard refuses', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<RightsRequestTemplate {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copiar modelo' }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Copiar modelo' })).toBeVisible();
  });

  it('opens a mail draft with the encoded subject and body', () => {
    render(<RightsRequestTemplate {...props} />);

    const link = screen.getByRole('link', { name: props.channel });
    expect(link).toHaveAttribute(
      'href',
      `mailto:${props.channel}?subject=${encodeURIComponent('Solicitação LGPD')}&body=${encodeURIComponent(props.body)}`
    );
  });
});
