import { expect, afterAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { stopLogWriter } from '@/lib/log-store';

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

afterAll(async () => {
  await stopLogWriter();
});
