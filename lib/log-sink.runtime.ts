import { registerLogSink } from './logger';
import { enqueueLogEvent } from './log-store';

registerLogSink((entry) => {
  enqueueLogEvent(entry);
});
