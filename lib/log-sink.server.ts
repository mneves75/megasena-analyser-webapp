import 'server-only';

import { registerLogSink } from './logger';
import { enqueueLogEvent } from './log-store';

if (typeof process === 'undefined' || process.env['NEXT_RUNTIME'] === 'edge') {
  // Avoid Bun/SQLite usage in edge runtime.
} else if (typeof globalThis.Bun !== 'undefined') {
  registerLogSink((entry) => {
    enqueueLogEvent(entry);
  });
}
