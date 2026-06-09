import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@/components/theme-provider';
import { ReactNode } from 'react';

/**
 * Test suite for ThemeProvider focusing on:
 * 1. localStorage persistence
 * 2. Media query event listener cleanup
 * 3. DOM manipulation for theme application
 *
 * CRITICAL: These tests verify the excellent patterns found in Carmack review.
 */

// Test component that uses the theme context
function TestConsumer() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <div>
      <div data-testid="current-theme">{theme}</div>
      <div data-testid="resolved-theme">{resolvedTheme}</div>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('system')}>Set System</button>
    </div>
  );
}

describe('ThemeProvider - localStorage Persistence', () => {
  let mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {};

    global.localStorage = {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: vi.fn(() => {
        mockLocalStorage = {};
      }),
      length: 0,
      key: vi.fn(),
    } as any;

    // Mock window.matchMedia
    global.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load theme from localStorage on mount', () => {
    // Set initial value in localStorage
    mockLocalStorage['megasena-theme'] = 'dark';

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    // Should load 'dark' from localStorage
    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
  });

  it('should save theme to localStorage when changed', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    const setDarkButton = screen.getByText('Set Dark');

    act(() => {
      setDarkButton.click();
    });

    // Should save to localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith('megasena-theme', 'dark');
    expect(mockLocalStorage['megasena-theme']).toBe('dark');
  });

  it('should use default theme if nothing in localStorage', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <TestConsumer />
      </ThemeProvider>
    );

    // Should use default
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
  });

  it('should respect custom storageKey prop', () => {
    mockLocalStorage['custom-key'] = 'dark';

    render(
      <ThemeProvider storageKey="custom-key">
        <TestConsumer />
      </ThemeProvider>
    );

    // Should load from custom key
    expect(localStorage.getItem).toHaveBeenCalledWith('custom-key');
  });
});

describe('ThemeProvider - Media Query Event Listener Cleanup', () => {
  let addEventListenerSpy: ReturnType<typeof vi.fn>;
  let removeEventListenerSpy: ReturnType<typeof vi.fn>;
  let mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    addEventListenerSpy = vi.fn();
    removeEventListenerSpy = vi.fn();
    mockLocalStorage = {};

    global.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
      dispatchEvent: vi.fn(),
    }));

    global.localStorage = {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    } as any;
  });

  it('should add media query listener when theme is system', () => {
    render(
      <ThemeProvider defaultTheme="system">
        <TestConsumer />
      </ThemeProvider>
    );

    // Should add listener for system theme
    expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should remove media query listener on unmount', () => {
    const { unmount } = render(
      <ThemeProvider defaultTheme="system">
        <TestConsumer />
      </ThemeProvider>
    );

    // Verify listener was added
    expect(addEventListenerSpy).toHaveBeenCalled();

    // Unmount component
    unmount();

    // Should remove listener (cleanup function)
    expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should not add listener when theme is not system', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <TestConsumer />
      </ThemeProvider>
    );

    // Should NOT add listener for non-system theme
    expect(addEventListenerSpy).not.toHaveBeenCalled();
  });

  it('should cleanup listener when switching from system to light', () => {
    const { rerender } = render(
      <ThemeProvider defaultTheme="system">
        <TestConsumer />
      </ThemeProvider>
    );

    // Verify listener was added for system theme
    expect(addEventListenerSpy).toHaveBeenCalled();

    // Change theme to light
    const setLightButton = screen.getByText('Set Light');
    act(() => {
      setLightButton.click();
    });

    // Should remove listener when no longer in system mode
    // (effect re-runs with new theme, early return prevents re-adding)
    expect(removeEventListenerSpy).toHaveBeenCalled();
  });
});

describe('ThemeProvider - DOM Manipulation', () => {
  let mockDocumentElement: HTMLElement;

  beforeEach(() => {
    // Create mock document element
    mockDocumentElement = document.createElement('html');
    Object.defineProperty(document, 'documentElement', {
      writable: true,
      configurable: true,
      value: mockDocumentElement,
    });

    global.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    global.localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    } as any;
  });

  it('should apply theme class to document root', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <TestConsumer />
      </ThemeProvider>
    );

    // Should add 'dark' class to html element
    expect(mockDocumentElement.classList.contains('dark')).toBe(true);
  });

  it('should remove previous theme class when changing', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <TestConsumer />
      </ThemeProvider>
    );

    // Initial: should have 'dark'
    expect(mockDocumentElement.classList.contains('dark')).toBe(true);

    // Change to light
    const setLightButton = screen.getByText('Set Light');
    act(() => {
      setLightButton.click();
    });

    // Should remove 'dark' and add 'light'
    expect(mockDocumentElement.classList.contains('dark')).toBe(false);
    expect(mockDocumentElement.classList.contains('light')).toBe(true);
  });

  it('should resolve system theme based on matchMedia', () => {
    // Mock dark mode preference
    global.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <ThemeProvider defaultTheme="system">
        <TestConsumer />
      </ThemeProvider>
    );

    // Should resolve to 'dark' based on media query
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark');
    expect(mockDocumentElement.classList.contains('dark')).toBe(true);
  });
});

/**
 * REGRESSION TESTS:
 * Ensure we never break the cleanup patterns.
 */
describe('ThemeProvider - Regression Prevention', () => {
  beforeEach(() => {
    global.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    global.localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    } as any;
  });

  it('should not throw errors when unmounting', () => {
    const { unmount } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(() => unmount()).not.toThrow();
  });

  it('should throw error if useTheme is used outside provider', () => {
    // Suppress console.error for this test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useTheme must be used within ThemeProvider');

    consoleErrorSpy.mockRestore();
  });

  it('should handle rapid theme changes without errors', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    const setDarkButton = screen.getByText('Set Dark');
    const setLightButton = screen.getByText('Set Light');
    const setSystemButton = screen.getByText('Set System');

    // Rapid changes
    act(() => {
      setDarkButton.click();
      setLightButton.click();
      setSystemButton.click();
      setDarkButton.click();
    });

    // Should handle without errors
    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
  });
});
