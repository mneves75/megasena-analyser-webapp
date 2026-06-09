import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders a safe button element by default', () => {
    render(<Button>Acionar</Button>);

    const button = screen.getByRole('button', { name: 'Acionar' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('renders the child element instead of nesting interactive elements when using asChild', () => {
    render(
      <Button asChild>
        <Link href="/dashboard">Ir para dashboard</Link>
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Ir para dashboard' });
    expect(link.tagName).toBe('A');
    expect(link.querySelector('button')).toBeNull();
  });
});
