import type { LogSink } from './logger';

interface LogContext {
  getStore(): LogSink | undefined;
  run<T>(sink: LogSink, callback: () => T): T;
}

let runtimeContext: LogContext | undefined;

export function installLogContext(context: LogContext): void {
  runtimeContext = context;
}

export function getScopedLogSink(): LogSink | undefined {
  return runtimeContext?.getStore();
}

export function runWithLogSink<T>(sink: LogSink, callback: () => T): T {
  if (!runtimeContext) {
    throw new Error('Request log scope requires the server log-context.runtime adapter');
  }
  return runtimeContext.run(sink, callback);
}
