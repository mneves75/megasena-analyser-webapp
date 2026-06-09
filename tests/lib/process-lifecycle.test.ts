import { describe, expect, it, vi } from 'vitest';
import { stopSubprocess, type ManagedSubprocess } from '@/lib/process-lifecycle';

function createProcessMock(): {
  processRef: ManagedSubprocess;
  resolveExit: (code: number | null) => void;
  kill: ReturnType<typeof vi.fn>;
} {
  let resolveExit!: (code: number | null) => void;
  const exited = new Promise<number | null>((resolve) => {
    resolveExit = resolve;
  });
  const kill = vi.fn();

  return {
    processRef: {
      exited,
      kill,
    },
    resolveExit,
    kill,
  };
}

describe('stopSubprocess', () => {
  it('waits for graceful exit after SIGTERM', async () => {
    const { processRef, resolveExit, kill } = createProcessMock();
    const logs: string[] = [];

    const stopPromise = stopSubprocess(processRef, {
      label: 'API server',
      graceMs: 100,
      log: (message) => logs.push(message),
      warn: (message) => logs.push(message),
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    resolveExit(0);

    await expect(stopPromise).resolves.toBe('exited');
    expect(kill).toHaveBeenCalledTimes(1);
    expect(kill).toHaveBeenCalledWith('SIGTERM');
    expect(logs).toContain('[OK] API server stopped');
  });

  it('forces shutdown when the process does not exit within the grace period', async () => {
    const { processRef, resolveExit, kill } = createProcessMock();
    const logs: string[] = [];

    const stopPromise = stopSubprocess(processRef, {
      label: 'Next.js server',
      graceMs: 1,
      log: (message) => logs.push(message),
      warn: (message) => logs.push(message),
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    resolveExit(null);

    await expect(stopPromise).resolves.toBe('force-killed');
    expect(kill).toHaveBeenCalledTimes(2);
    expect(kill).toHaveBeenNthCalledWith(1, 'SIGTERM');
    expect(kill).toHaveBeenNthCalledWith(2, 'SIGKILL');
    expect(logs).toContain('Next.js server did not stop within 1ms, forcing shutdown...');
    expect(logs).toContain('[OK] Next.js server force-stopped');
  });
});
