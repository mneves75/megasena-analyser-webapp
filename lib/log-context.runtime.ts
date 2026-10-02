import { AsyncLocalStorage } from 'node:async_hooks';
import { installLogContext } from './log-context';
import type { LogSink } from './logger';

// Imported only by server entry points; shared logger imports stay browser-safe.
installLogContext(new AsyncLocalStorage<LogSink>());
