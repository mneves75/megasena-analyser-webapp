export interface ManagedSubprocess {
  readonly exited: Promise<number | null>;
  kill(signal?: NodeJS.Signals | number): void;
}

export interface StopSubprocessOptions {
  label: string;
  graceMs: number;
  terminateSignal?: NodeJS.Signals;
  forceSignal?: NodeJS.Signals;
  log?: (message: string) => void;
  warn?: (message: string) => void;
}

export type StopSubprocessResult = 'exited' | 'force-killed';

function delay(timeoutMs: number): Promise<'timeout'> {
  return new Promise((resolve) => {
    setTimeout(() => resolve('timeout'), timeoutMs);
  });
}

async function waitForExit(processRef: ManagedSubprocess, timeoutMs: number): Promise<boolean> {
  const result = await Promise.race([
    processRef.exited.then(() => 'exited' as const),
    delay(timeoutMs),
  ]);

  return result === 'exited';
}

export async function stopSubprocess(
  processRef: ManagedSubprocess,
  {
    label,
    graceMs,
    terminateSignal = 'SIGTERM',
    forceSignal = 'SIGKILL',
    log = console.log,
    warn = console.warn,
  }: StopSubprocessOptions
): Promise<StopSubprocessResult> {
  log(`Stopping ${label}...`);
  processRef.kill(terminateSignal);

  if (await waitForExit(processRef, graceMs)) {
    log(`[OK] ${label} stopped`);
    return 'exited';
  }

  warn(`${label} did not stop within ${graceMs}ms, forcing shutdown...`);
  processRef.kill(forceSignal);
  await processRef.exited;
  log(`[OK] ${label} force-stopped`);
  return 'force-killed';
}
