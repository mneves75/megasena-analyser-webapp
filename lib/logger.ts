/**
 * Production-ready logger utility
 * Replaces console.log with structured logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  event: string;
  level: LogLevel;
  timestamp: string;
  requestId?: string;
  sessionId?: string;
  userId?: string;
  route?: string;
  userAgent?: string;
  launchStage?: string;
  durationMs?: number;
  statusCode?: number;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private isDevelopment: boolean;
  private isDebugEnabled: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.isDebugEnabled = process.env.DEBUG === 'true';
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }
    return value.slice(0, maxLength);
  }

  private shouldIncludeErrorStack(): boolean {
    return this.isDevelopment || this.isDebugEnabled;
  }

  private sanitizeString(value: string, maxLength: number): string {
    // Prevent log injection and runaway payload sizes.
    return this.truncate(value.replace(/[\r\n\t]/g, ' '), maxLength);
  }

  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const redactionKeyPattern = /(authorization|token|secret|password|cookie|set-cookie)/i;

    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'undefined') {
        continue;
      }

      if (redactionKeyPattern.test(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value, 500);
        continue;
      }

      sanitized[key] = value;
    }

    return sanitized;
  }

  private safeJsonStringify(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      const fallbackError =
        error instanceof Error
          ? { name: error.name, message: this.truncate(error.message, 120) }
          : { name: 'NonErrorThrown', message: this.sanitizeString(String(error), 120) };

      return JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'logger.stringify_failed',
        error: fallbackError,
      } satisfies LogEntry);
    }
  }

  private log(level: LogLevel, event: string, context?: Record<string, unknown>, error?: unknown): void {
    const {
      requestId,
      sessionId,
      userId,
      route,
      endpoint,
      userAgent,
      launchStage,
      durationMs,
      statusCode,
      ...rest
    } = context ?? {};

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      requestId: typeof requestId === 'string' ? requestId : undefined,
      sessionId: typeof sessionId === 'string' ? sessionId : undefined,
      userId: typeof userId === 'string' ? userId : undefined,
      route: typeof route === 'string' ? route : typeof endpoint === 'string' ? endpoint : undefined,
      userAgent: typeof userAgent === 'string' ? this.sanitizeString(userAgent, 120) : undefined,
      launchStage: typeof launchStage === 'string' ? launchStage : process.env.NODE_ENV ?? 'development',
      durationMs: typeof durationMs === 'number' ? Math.round(durationMs) : undefined,
      statusCode: typeof statusCode === 'number' ? Math.round(statusCode) : undefined,
      metadata: Object.keys(rest).length > 0 ? this.sanitizeMetadata(rest) : undefined,
    };

    if (error instanceof Error) {
      const includeStack = this.shouldIncludeErrorStack();
      entry.error = {
        name: error.name,
        message: this.truncate(error.message, 120),
        ...(includeStack ? { stack: error.stack } : {}),
      };
    } else if (typeof error !== 'undefined') {
      entry.error = {
        name: 'NonErrorThrown',
        message: this.sanitizeString(String(error), 120),
      };
    }

    const formatted = this.safeJsonStringify(entry);

    switch (level) {
      case 'debug':
        if (this.isDebugEnabled) {
          console.debug(formatted);
        }
        break;
      case 'info':
        console.log(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  debug(event: string, context?: Record<string, unknown>): void {
    this.log('debug', event, context);
  }

  info(event: string, context?: Record<string, unknown>): void {
    this.log('info', event, context);
  }

  warn(event: string, context?: Record<string, unknown>): void {
    this.log('warn', event, context);
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    this.log('error', message, context, error);
  }

  // Utility methods for common scenarios
  apiRequest(method: string, path: string, duration?: number): void {
    this.info('api.request', {
      method,
      route: path,
      durationMs: typeof duration === 'number' ? duration : undefined,
    });
  }

  apiError(method: string, path: string, error: unknown): void {
    this.error('api.error', error, { method, route: path });
  }

  dbQuery(query: string, duration?: number): void {
    if (this.isDebugEnabled) {
      this.debug('db.query', {
        query: this.sanitizeString(query, 500),
        durationMs: typeof duration === 'number' ? duration : undefined,
      });
    }
  }

  migration(name: string, status: 'start' | 'success' | 'error'): void {
    const level: LogLevel = status === 'error' ? 'error' : 'info';
    this.log(level, 'db.migration', { name, status });
  }
}

// Singleton instance
export const logger = new Logger();

// Convenience exports
export const { debug, info, warn, error } = logger;
